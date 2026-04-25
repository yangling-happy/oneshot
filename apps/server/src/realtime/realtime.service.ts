import { Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { CanvasOp } from './op.types';
import { gzip } from 'zlib';
import { promisify } from 'util';

const compress = promisify(gzip);

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly docs = new Map<string, Y.Doc>();
  private readonly docConnections = new Map<string, Set<any>>();
  private readonly batchUpdates = new Map<
    string,
    { ops: CanvasOp[]; timer: NodeJS.Timeout }
  >();
  private readonly BATCH_WINDOW = 50; // 50ms批量窗口

  onConnect({
    connection,
    documentName,
  }: {
    connection: any;
    documentName: string;
  }) {
    if (!this.docConnections.has(documentName)) {
      this.docConnections.set(documentName, new Set());
    }
    this.docConnections.get(documentName)!.add(connection);
    this.logger.debug(
      `Client connected to doc ${documentName}, total: ${this.docConnections.get(documentName)!.size}`,
    );
  }

  onDisconnect({
    connection,
    documentName,
  }: {
    connection: any;
    documentName: string;
  }) {
    const connections = this.docConnections.get(documentName);
    if (connections) {
      connections.delete(connection);
      if (connections.size === 0) {
        this.docConnections.delete(documentName);
      }
      this.logger.debug(
        `Client disconnected from doc ${documentName}, total: ${connections?.size ?? 0}`,
      );
    }
  }

  getOrCreateDoc(docName: string): Y.Doc {
    const existing = this.docs.get(docName);
    if (existing) {
      return existing;
    }

    const doc = new Y.Doc();
    doc.getMap('canvas').set('createdAt', Date.now());
    doc.getMap('canvas').set('version', 1);
    doc.getArray<CanvasOp>('ops');

    // 监听文档更新事件，获取增量更新
    doc.on('update', async (update: Uint8Array, origin: any) => {
      // 跳过本地事务产生的更新，避免重复广播
      if (origin === 'realtime-service') return;

      await this.broadcastUpdate(docName, update);
    });

    this.docs.set(docName, doc);
    this.logger.log(`Initialized Yjs doc: ${docName}`);
    return doc;
  }

  private async broadcastUpdate(docName: string, update: Uint8Array) {
    const connections = this.docConnections.get(docName);
    if (!connections || connections.size === 0) return;

    try {
      // 压缩更新消息
      const compressedUpdate = await compress(Buffer.from(update));
      const message = new Uint8Array([1, ...compressedUpdate]); // 1表示压缩的增量更新

      // 并行发送到所有客户端
      const promises = Array.from(connections).map(async (conn: any) => {
        try {
          if (conn.readyState === 1) {
            // 1表示OPEN状态
            await conn.write(message);
          }
        } catch (e) {
          this.logger.warn(
            `Failed to send update to client: ${(e as Error).message}`,
          );
        }
      });

      await Promise.allSettled(promises);
      this.logger.debug(
        `Broadcasted incremental update to ${connections.size} clients for doc ${docName}, size: ${compressedUpdate.length} bytes`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast update: ${(error as Error).message}`,
      );
    }
  }

  async appendOps(docName: string, ops: CanvasOp[]): Promise<number> {
    const doc = this.getOrCreateDoc(docName);
    const opArray = doc.getArray<CanvasOp>('ops');

    // 实现批量合并
    if (this.batchUpdates.has(docName)) {
      const batch = this.batchUpdates.get(docName)!;
      batch.ops.push(...ops);
      return opArray.length + batch.ops.length;
    }

    // 创建新的批量任务
    const timer = setTimeout(async () => {
      const batch = this.batchUpdates.get(docName);
      if (!batch || batch.ops.length === 0) {
        this.batchUpdates.delete(docName);
        return;
      }

      const doc = this.getOrCreateDoc(docName);
      const opArray = doc.getArray<CanvasOp>('ops');

      doc.transact(() => {
        opArray.push(batch.ops);
      }, 'realtime-service'); // 标记为服务端发起的事务

      const total = opArray.length;
      this.logger.log(
        `Appended ${batch.ops.length} ops to ${docName} (batched), total=${total}`,
      );
      this.batchUpdates.delete(docName);
    }, this.BATCH_WINDOW);

    this.batchUpdates.set(docName, { ops, timer });
    return opArray.length + ops.length;
  }

  /**
   * 立即刷新所有批量更新，用于测试或需要立即同步的场景
   */
  async flushBatchUpdates(docName?: string) {
    const docsToFlush = docName
      ? [docName]
      : Array.from(this.batchUpdates.keys());

    for (const doc of docsToFlush) {
      const batch = this.batchUpdates.get(doc);
      if (batch) {
        clearTimeout(batch.timer);
        if (batch.ops.length > 0) {
          const ydoc = this.getOrCreateDoc(doc);
          const opArray = ydoc.getArray<CanvasOp>('ops');

          ydoc.transact(() => {
            opArray.push(batch.ops);
          }, 'realtime-service');

          this.logger.log(
            `Flushed ${batch.ops.length} ops for doc ${doc}, total=${opArray.length}`,
          );
        }
        this.batchUpdates.delete(doc);
      }
    }
  }
}
