# Plan 1 Demo Guide

## 1) Install dependencies

```bash
pnpm install
```

## 2) Start services

Open three terminals from repo root:

```bash
pnpm --filter server start:dev
```

```bash
pnpm --filter desktop electron
```

```bash
pnpm --filter mobile start
```

## 3) Smoke test

Use mobile IM page and send commands like:

- `画一个标题为 Oneshot 的矩形`
- `draw arrow from A to B`
- `add text: demo`

Or call backend directly:

```bash
curl -X POST http://localhost:3000/agent/command \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"画一个矩形\"}"
```

Mock Feishu webhook:

```bash
curl -X POST http://localhost:3000/mock/feishu \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"draw arrow\"}"
```

## 4) Expected behavior

- Backend returns `status=accepted`.
- Desktop Tldraw receives incremental `ops` via Hocuspocus and renders shapes.
- Repeated commands keep appending to `Y.Array(\"ops\")`.
