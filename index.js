/**
 * Babel USD Signals Bot - Cloudflare Worker (Telegram Webhook)
 *
 * ENV VARS (Cloudflare -> Worker -> Settings -> Variables):
 *  - BOT_TOKEN (Secret)       : token BotFather
 *  - ADMIN_ID (Text)          : ton Telegram user id (ex: "123456789")
 *  - VIP_CHAT_ID (Text, opt)  : id du canal/groupe VIP (ex: "-1001234567890")
 *  - WEBHOOK_SECRET (Secret, opt) : si tu veux sécuriser le webhook
 */

const API = "https://api.telegram.org";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function text(data, status = 200) {
  return new Response(data, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function tg(env, method, payload) {
  const url = `${API}/bot${env.BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    // Log côté Cloudflare (Observability)
    console.log("Telegram API error:", method, data);
  }
  return data;
}

async function sendMessage(env, chatId, message, extra = {}) {
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

function isAdmin(env, fromId) {
  return String(fromId) === String(env.ADMIN_ID);
}

function formatSignalExample() {
  // Ton format canal privé
  return [
    "<b>XAUUSD BUY à 5084 – 5087</b>",
    "",
    "<b>SL</b> : 5078",
    "<b>TP1</b> : 5093",
    "<b>TP2</b> : 5100",
    "",
    "ℹ️ <i>Risk management strict.</i>",
  ].join("\n");
}

async function handleMessage(env, msg) {
  const chatId = msg.chat?.id;
  const fromId = msg.from?.id;
  const textMsg = (msg.text || "").trim();

  if (!chatId) return;

  // Commandes de base
  if (textMsg === "/start") {
    const reply = [
      "✅ Bot connecté.",
      "",
      "Commandes :",
      "• /ping",
      "• /signal (admin)",
      "• /post <message> (admin -> poste dans VIP_CHAT_ID)",
    ].join("\n");
    await sendMessage(env, chatId, reply);
    return;
  }

  if (textMsg === "/ping") {
    await sendMessage(env, chatId, "🏓 pong");
    return;
  }

  // Admin only
  if (textMsg === "/signal") {
    if (!isAdmin(env, fromId)) {
      await sendMessage(env, chatId, "⛔️ Commande réservée à l’admin.");
      return;
    }
    await sendMessage(env, chatId, formatSignalExample());
    return;
  }

  // /post <message>
  if (textMsg.startsWith("/post")) {
    if (!isAdmin(env, fromId)) {
      await sendMessage(env, chatId, "⛔️ Commande réservée à l’admin.");
      return;
    }
    if (!env.VIP_CHAT_ID) {
      await sendMessage(env, chatId, "⚠️ VIP_CHAT_ID n’est pas configuré dans Cloudflare.");
      return;
    }

    const body = textMsg.replace(/^\/post\s*/i, "").trim();
    if (!body) {
      await sendMessage(env, chatId, "Utilisation : /post <ton message>");
      return;
    }

    await sendMessage(env, env.VIP_CHAT_ID, body);
    await sendMessage(env, chatId, "✅ Message posté dans le canal VIP.");
    return;
  }

  // Réponse simple si l’utilisateur écrit sans commande
  await sendMessage(env, chatId, "✅ Reçu. Tape /start pour voir les commandes.");
}

async function handleCallback(env, cb) {
  // Si plus tard tu ajoutes des boutons inline
  const chatId = cb.message?.chat?.id;
  if (chatId) await sendMessage(env, chatId, "✅ Callback reçu.");
  // Toujours répondre au callback sinon Telegram affiche un loader
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "OK" });
}

export default {
  async fetch(request, env, ctx) {
    if (!env.BOT_TOKEN) return text("Missing BOT_TOKEN", 500);
    if (!env.ADMIN_ID) return text("Missing ADMIN_ID", 500);

    const url = new URL(request.url);

    // ✅ Healthcheck simple
    if (request.method === "GET") {
      return text("OK", 200);
    }

    // ✅ On n'accepte Telegram QUE sur /webhook
    if (url.pathname !== "/webhook") {
      return text("Not Found", 404);
    }

    // ✅ Protection optionnelle par secret header (si activé)
    if (env.WEBHOOK_SECRET) {
      const sec = request.headers.get("x-telegram-bot-api-secret-token");
      if (sec !== env.WEBHOOK_SECRET) return text("Unauthorized", 401);
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return text("Bad JSON", 400);
    }

    if (update.message) {
      ctx.waitUntil(handleMessage(env, update.message));
    } else if (update.callback_query) {
      ctx.waitUntil(handleCallback(env, update.callback_query));
    }

    return text("OK", 200);
  },
};