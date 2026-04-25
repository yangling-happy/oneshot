import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import { AppModule } from './app.module';
import { RealtimeService } from './realtime/realtime.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const realtimeService = app.get(RealtimeService);

  const apiPort = Number(process.env.PORT ?? 3000);
  const hocuspocusPort = Number(process.env.HOCUSPOCUS_PORT ?? 1234);

  const hocuspocus = new Server({
    port: hocuspocusPort,
    name: 'oneshot-hocuspocus',
    onListen: async () => {
      logger.log(`Hocuspocus listening on ${hocuspocusPort}`);
    },
    onLoadDocument: async (data) => {
      const docName = data.documentName;
      return realtimeService.getOrCreateDoc(docName);
    },
  });

  realtimeService.setHocuspocusInstance(hocuspocus);

  await hocuspocus.listen();
  await app.listen(apiPort);
  logger.log(`Nest API listening on ${apiPort}`);
}
bootstrap();
