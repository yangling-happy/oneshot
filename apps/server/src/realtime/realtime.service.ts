import { Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { CanvasOp } from './op.types';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly docs = new Map<string, Y.Doc>();
  private hocuspocus: Server | null = null;

  setHocuspocusInstance(instance: Server) {
    this.hocuspocus = instance;
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
    this.docs.set(docName, doc);
    this.logger.log(`Initialized Yjs doc: ${docName}`);
    return doc;
  }

  async appendOps(docName: string, ops: CanvasOp[]): Promise<number> {
    const doc = this.getOrCreateDoc(docName);
    const opArray = doc.getArray<CanvasOp>('ops');

    let update!: Uint8Array;
    doc.transact(() => {
      opArray.push(ops);
      update = Y.encodeStateAsUpdate(doc);
    });

    const total = opArray.length;
    this.logger.log(`Appended ${ops.length} ops to ${docName}, total=${total}`);

    // 主动广播更新到所有连接的客户端，解决延迟问题
    if (this.hocuspocus && update) {
      try {
        // 遍历所有Hocuspocus连接，发送更新
        const connections = Array.from(
          (this.hocuspocus as any).connections || [],
        );
        connections.forEach((conn: any) => {
          if (conn.documentName === docName) {
            conn.write(new Uint8Array([0, ...update])); // 0表示消息类型是更新
          }
        });
        this.logger.log(`Broadcasted update to ${connections.length} clients`);
      } catch (error) {
        this.logger.error(
          `Failed to broadcast update: ${(error as Error).message}`,
        );
      }
    }

    return total;
  }
}
