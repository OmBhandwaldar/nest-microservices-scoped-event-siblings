# Other event handlers don't run when a request-scoped one fails to resolve

Minimal reproduction for NestJS microservices: two `@EventPattern('user.created')` handlers in two
controllers. `NotificationsController` depends on a request-scoped provider whose factory fails.
When it is registered first, `AuditController` never runs for the event either. When it is registered
second, `AuditController` runs.

Tested with `@nestjs/core` 12.1.3, `@nestjs/microservices` 12.1.3 (also 10.4.15 and 11.2.7), Node.js
24.16.0, macOS. TCP transport, no broker needed.

```sh
npm install
npm start
```

The script starts the microservice once per registration order and emits one `user.created` event:

```
handlers registered: Notifications, Audit    -> ran: []
handlers registered: Audit, Notifications    -> ran: ["audit 1"]
```

Expected: `["audit 1"]` in both cases (only the handler whose dependency failed is skipped).
