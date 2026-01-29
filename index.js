 /**
 * Babel USD Signals Bot - Cloudflare Worker (Telegram Webhook)
 *
 * Variables Cloudflare (Worker -> Settings -> Variables):
 *  - BOT_TOKEN (Secret)       : token BotFather
 *  - ADMIN_ID (Text)          : ton Telegram user id (ex: "123456789")
 *  - VIP_CHAT_ID (Text, opt)  : id du canal/groupe VIP (ex: "-1001234567890")
 *  - WEBHOOK_SECRET (Secret, opt) : protège le webhook via header secret
 */

const API = "https://api.telegram.org";

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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
  if (!data.ok) console.log("Telegram API error:", method, data);
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
  const txt = (msg.text || "").trim();

  if (!chatId) return;

  if (txt === "/start") {
    const reply = [
      "✅ Bot connecté.",
      "",
      "Commandes :",
      "• /ping",
      "• /signal (admin)",
      "• /post <message> (admin -> poste dans VIP_CHAT_ID)",
      "• /id (affiche ton id + id du chat)",
    ].join("\n");
    await sendMessage(env, chatId, reply);
    return;
  }

  if (txt === "/ping") {
    await sendMessage(env, chatId, "🏓 pong");
    return;
  }

  if (txt === "/id") {
    await sendMessage(
      env,
      chatId,
      `👤 <b>Ton ID</b>: <code>${fromId}</code>\n💬 <b>Chat ID</b>: <code>${chatId}</code>`
    );
    return;
  }

  if (txt === "/signal") {
    if (!isAdmin(env, fromId)) {
      await sendMessage(env, chatId, "⛔️ Commande réservée à l’admin.");
      return;
    }
    await sendMessage(env, chatId, formatSignalExample());
    return;
  }

  if (txt.startsWith("/post")) {
    if (!isAdmin(env, fromId)) {
      await sendMessage(env, chatId, "⛔️ Commande réservée à l’admin.");
      return;
    }
    if (!env.VIP_CHAT_ID) {
      await sendMessage(env, chatId, "⚠️ VIP_CHAT_ID n’est pas configuré dans Cloudflare.");
      return;
    }

    const body = txt.replace(/^\/post\s*/i, "").trim();
    if (!body) {
      await sendMessage(env, chatId, "Utilisation : /post <ton message>");
      return;
    }

    await sendMessage(env, env.VIP_CHAT_ID, body);
    await sendMessage(env, chatId, "✅ Message posté dans le canal VIP.");
    return;
  }

  await sendMessage(env, chatId, "✅ Reçu. Tape /start pour voir les commandes.");
}

async function handleCallback(env, cb) {
  const chatId = cb.message?.chat?.id;
  if (chatId) await sendMessage(env, chatId, "✅ Callback reçu.");
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "OK" });
}

export default {
  async fetch(request, env, ctx) {
    // Variables obligatoires
    if (!env.BOT_TOKEN) return text("Missing BOT_TOKEN", 500);
    if (!env.ADMIN_ID) return text("Missing ADMIN_ID", 500);

    const url = new URL(request.url);

    // GET: healthcheck (aucun redirect, juste OK)
    if (request.method === "GET") {
      if (url.pathname === "/health" || url.pathname === "/" || url.pathname === "/webhook") {
        return text("OK", 200);
      }
      return text("OK", 200);
    }

    // Protection webhook optionnelle (si WEBHOOK_SECRET est défini)
    if (env.WEBHOOK_SECRET) {
      const sec = request.headers.get("x-telegram-bot-api-secret-token");
      if (sec !== env.WEBHOOK_SECRET) return text("Unauthorized", 401);
    }

    // POST: Telegram webhook
    let update;
    try {
      update = await request.json();
    } catch {
      return text("Bad JSON", 400);
    }

    console.log("Incoming update keys:", Object.keys(update || {}));

    if (update.message) {
      ctx.waitUntil(handleMessage(env, update.message));
    } else if (update.callback_query) {
      ctx.waitUntil(handleCallback(env, update.callback_query));
    }

    // Telegram veut 200 OK (pas 302)
    return text("OK", 200);
  },
};