const API = "https://api.telegram.org";

const TEMPLATE_SIGNAL = `XAUUSD BUY à 5084 – 5087\n\nSL : 5078\nTP1 : 5093\nTP2 : 5100\n\nℹ️ Risk management strict.`;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
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
  return { ok: res.ok && data.ok, status: res.status, data };
}

async function sendMessage(env, chatId, text, extra = {}) {
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
}

function isAdmin(env, userId) {
  const a = String(env.ADMIN_ID || "").trim();
  return a !== "" && String(userId) === a;
}

function cmdOf(text) {
  const t = String(text || "").trim();
  if (!t.startsWith("/")) return null;
  return t.split(/\s+/)[0].toLowerCase();
}

function helpText() {
  return (
    "<b>Menu</b>\n" +
    "• /buy - Prix & paiement\n" +
    "• /signal - Exemple signal\n" +
    "• /help - Aide\n" +
    "• (Admin) /push <signal>\n"
  );
}

function buyText(env) {
  const w = env.PRICE_WEEK || "25";
  const m = env.PRICE_MONTH || "84";
  const addr = env.TRC20_ADDRESS || "TON_ADRESSE_TRC20";
  const sup = env.SUPPORT_USER || "babelwallstreet";
  return (
    `<b>Accès VIP Babel USD</b>\n\n` +
    `• 1 semaine : <b>${w}$</b>\n` +
    `• 1 mois : <b>${m}$</b>\n\n` +
    `<b>Paiement USDT (TRC20)</b>\n${addr}\n\n` +
    `Support : @${sup}`
  );
}

async function handleMessage(env, msg) {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id;
  const text = msg.text || "";
  const cmd = cmdOf(text);

  if (cmd === "/start") {
    await sendMessage(env, chatId, `Bienvenue 👋\n\n${helpText()}`);
    return;
  }
  if (cmd === "/help") {
    await sendMessage(env, chatId, helpText());
    return;
  }
  if (cmd === "/buy") {
    await sendMessage(env, chatId, buyText(env));
    return;
  }
  if (cmd === "/signal") {
    await sendMessage(env, chatId, `<b>Format signal</b>\n\n${TEMPLATE_SIGNAL}`);
    return;
  }
  if (cmd === "/push") {
    if (!isAdmin(env, userId)) {
      await sendMessage(env, chatId, "Accès refusé.");
      return;
    }
    const vip = String(env.VIP_CHAT_ID || "").trim();
    if (!vip) {
      await sendMessage(env, chatId, "VIP_CHAT_ID n'est pas configuré.");
      return;
    }
    const content = text.replace(/^\/push\s*/i, "").trim();
    if (!content) {
      await sendMessage(env, chatId, "Utilise: /push <ton signal>");
      return;
    }
    const r = await sendMessage(env, vip, content);
    await sendMessage(env, chatId, r.ok ? "✅ Envoyé." : `Erreur: ${r.status}`);
    return;
  }

  await sendMessage(env, chatId, "Commande inconnue. Tape /help");
}

export default {
  async fetch(request, env, ctx) {
    if (env.WEBHOOK_SECRET) {
      const sec = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (sec !== env.WEBHOOK_SECRET) return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (request.method === "GET") return new Response("OK", { status: 200 });
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    let update;
    try {
      update = await request.json();
    } catch {
      return json({ ok: false, error: "Bad JSON" }, 400);
    }

    ctx.waitUntil((async () => {
      if (update.message) await handleMessage(env, update.message);
    })());

    return new Response("OK", { status: 200 });
  },
};
