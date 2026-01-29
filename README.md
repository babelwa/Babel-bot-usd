# Telegram Bot (Cloudflare Worker) + GitHub

Objectif: modifier ton bot depuis GitHub et déployer automatiquement sur Cloudflare Workers.

## Cloudflare (obligatoire)
Dans **Workers & Pages -> ton Worker -> Settings -> Variables & secrets**, ajoute:
- `BOT_TOKEN` (Secret)
- `ADMIN_ID` (Text/Secret)
- `VIP_CHAT_ID` (Text, optionnel)

Optionnel:
- `SUPPORT_USER`, `PRICE_WEEK`, `PRICE_MONTH`, `TRC20_ADDRESS`
- `WEBHOOK_SECRET` (Secret)

## GitHub (obligatoire)
Repo -> **Settings -> Secrets and variables -> Actions**:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Webhook Telegram
Après déploiement:
`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ton-worker>.workers.dev`

