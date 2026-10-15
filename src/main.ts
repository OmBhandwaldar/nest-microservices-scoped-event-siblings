import 'reflect-metadata';
import { Controller, Inject, Module, Scope, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ClientProxyFactory,
  EventPattern,
  MicroserviceOptions,
  Payload,
  Transport,
} from '@nestjs/microservices';

const handled: string[] = [];

// Request-scoped connection whose factory fails, e.g. the tenant's database is down.
const TENANT_DB = 'TENANT_DB';
const tenantDb = {
  provide: TENANT_DB,
  scope: Scope.REQUEST,
  useFactory: async () => {
    throw new Error('tenant database unavailable');
  },
};

@Controller()
class NotificationsController {
  constructor(@Inject(TENANT_DB) private readonly db: unknown) {}

  @EventPattern('user.created')
  notify(@Payload() user: { id: number }) {
    handled.push(`notifications ${user.id}`);
  }
}

@Controller()
class AuditController {
  @EventPattern('user.created')
  record(@Payload() user: { id: number }) {
    handled.push(`audit ${user.id}`);
  }
}

const options = { host: '127.0.0.1', port: 3891 };

async function run(controllers: Type<unknown>[]) {
  @Module({ controllers, providers: [tenantDb] })
  class AppModule {}

  handled.length = 0;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    { transport: Transport.TCP, options, logger: false },
  );
  await app.listen();

  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options,
  });
  await client.connect();
  client.emit('user.created', { id: 1 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  await client.close();
  await app.close();

  const order = controllers
    .map((c) => c.name.replace('Controller', ''))
    .join(', ');
  console.log(
    `handlers registered: ${order.padEnd(23)} -> ran: ${JSON.stringify(handled)}`,
  );
}

await run([NotificationsController, AuditController]);
await run([AuditController, NotificationsController]);
