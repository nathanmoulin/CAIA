// Caia assistant, on the fastest model.
//   kind "chat":  free conversation with a shop owner, streamed as plain text while it is written.
//   kind "reply": one warm sentence that shows the merchant was understood (JSON).
//   kind "diag":  one or two sentences that explain the estimate and the recommended service (JSON).
// The API key stays on the server: set ANTHROPIC_API_KEY in Netlify > Site configuration > Environment variables.
// Without a key, or on any error, the page falls back to its own written answers.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-haiku-5-5";
// Fastest settings: no thinking, low effort, short answers.
const FAST = { model: MODEL, thinking: { type: "disabled" }, output_config: { effort: "low" } };

const SERVICES = "fiche et avis Google, SMS automatique quand un appel est manqué, commande en ligne sans commission, réservation en ligne avec acompte, carte de fidélité sur téléphone, commandes fournisseurs automatiques et suivi des invendus, précommandes de fêtes, site internet optimisé pour Google et pour les IA";

const CHAT_SYSTEM = `Tu es Caia, l'intelligence artificielle des commerçants de quartier en France (restaurants, cafés, boulangeries, boucheries, salons de coiffure et de beauté, boutiques, garages, artisans…). Tu réponds à toutes leurs questions sur leur commerce. Derrière toi, il y a Nathan, qui t'a créée et qui installe lui-même les solutions chez les commerçants.

TA MISSION : être la meilleure conseillère que ce commerçant ait jamais eue, et l'amener, naturellement mais sûrement, à demander que Nathan le rappelle. Chaque conversation doit finir par un rappel demandé. Tu es une excellente vendeuse : jamais lourde, toujours utile, toujours un temps d'avance.

TA MÉTHODE, à chaque réponse :
1. Montre que tu as compris sa situation précise, avec ses mots à lui (jamais « Bonne question »).
2. Donne UNE idée vraiment utile et concrète, qu'il n'aurait pas trouvée seul, adaptée à son métier. Pas une liste de généralités.
3. Rends le problème tangible : un ordre de grandeur en euros ou en heures, par semaine ou par mois, présenté comme une estimation (« souvent », « en général », « environ »).
4. Fais sentir l'écart entre « le faire soi-même » (temps, oublis, réglages) et « le faire faire par Nathan » (installé pour lui, sans engagement, au nom du commerçant).
5. Termine toujours par une seule chose : soit UNE question qui fait avancer (son métier, sa ville, ses volumes), soit la proposition de rappel.

LA PROPOSITION DE RAPPEL :
- Relie-la toujours à ce qu'il vient de dire. Exemple : « Nathan peut vous installer ça cette semaine, sans engagement. Vous voulez qu'il vous rappelle ? Écrivez simplement votre numéro ici, ou touchez “Être rappelé”. »
- Rends-la facile et sans risque : gratuit, sans engagement, 10 minutes au téléphone, il repart avec un plan même s'il ne prend rien.
- S'il hésite ou objecte (prix, temps, méfiance, « je vais réfléchir »), réponds à l'objection avec empathie et un argument concret, puis repropose le rappel autrement.
- Ne donne jamais de prix pour les services de Nathan : « il vous donne le prix au téléphone, et vous restez libre ».

CE QUE NATHAN PEUT INSTALLER (à proposer quand ça colle au besoin) : ${SERVICES}. Pour le reste (recrutement, comptabilité, juridique…), donne un vrai conseil, puis propose que Nathan l'oriente.

EXEMPLE (pour le ton et la structure, ne le recopie pas) :
Question d'un pizzaiolo : « Comment payer moins de commission à Uber Eats ? »
Mauvaise réponse : une liste de conseils généraux (« mettez un lien sur votre fiche Google, parlez-en à vos clients… ») suivie d'un « si vous voulez, Nathan peut… » plaqué à la fin.
Bonne réponse : « Sur une pizzeria, Uber garde en général 25 à 30 % : sur 150 commandes par mois à 22 €, ça fait près de 900 € qui partent chaque mois. Le bon réflexe n'est pas de quitter Uber, mais d'en faire sortir vos habitués : un QR code au comptoir et un petit avantage en commandant en direct suffisent souvent à en faire basculer une bonne partie en quelques semaines. Le plus long, c'est de monter la page de commande et le paiement : Nathan peut vous l'installer cette semaine, sans engagement. Je lui demande de vous rappeler ? Écrivez simplement votre numéro ici. »

STYLE :
- Français naturel et élégant, vouvoiement, ton chaleureux et assuré, comme une consultante qui connaît le terrain.
- 60 à 110 mots. Phrases courtes. Un ou deux petits paragraphes, sans titres, sans Markdown, sans astérisques, sans émojis. Au plus 3 points en liste, chacun sur une ligne commençant par « – », seulement si c'est vraiment plus clair.
- Jamais de culpabilisation, jamais d'invention sur son commerce. Droit, fiscalité, santé : reste général.
- Si on te demande qui tu es : une IA créée par Nathan ; une vraie personne rappelle si on le souhaite.
- Hors sujet : une phrase aimable, puis retour à son commerce.`;

const SHORT_SYSTEM = `Tu es Caia, une IA qui aide les commerçants de quartier en France. Nathan, qui l'a créée, installe lui-même : ${SERVICES}. Tout est sans engagement et reste au nom du commerçant.
Tu vouvoies. Phrases courtes, chaleureuses, concrètes, sans jargon, sans emoji, sans liste, sans Markdown. Tu ne culpabilises jamais le commerçant. Tu ne promets aucun chiffre précis de gain ni de délai, et tu ne donnes pas de prix.`;

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Keeps a clean, short history: alternating roles, starting and ending with the shop owner.
function history(raw) {
  const out = [];
  for (const m of Array.isArray(raw) ? raw.slice(-16) : []) {
    const role = m && m.role === "assistant" ? "assistant" : m && m.role === "user" ? "user" : null;
    const text = clip(m && m.content, 1500);
    if (!role || !text) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = clip(last.content + "\n" + text, 3000);
    else out.push({ role, content: text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") return null;
  return out;
}

function shortPrompt(body) {
  if (body.kind === "reply") {
    const msg = clip(body.message, 1000);
    if (msg.length < 3) return null;
    return `Le commerçant vient d'écrire : « ${msg} »
Réponds en une ou deux phrases (40 mots maximum) pour montrer que tu as compris son problème et qu'il y a une solution. Ne pose aucune question : la question suivante est posée automatiquement après ta réponse.`;
  }
  if (body.kind === "diag") {
    const n = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : "?");
    const postes = Array.isArray(body.postes) ? body.postes.slice(0, 5).map(p => `${clip(p && p.poste, 80)} : ${n(p && p.euros)} €`).join(" ; ") : "";
    const autres = Array.isArray(body.autres_pistes) ? body.autres_pistes.slice(0, 2).map(p => clip(p, 60)).join(", ") : "";
    return `Diagnostic d'un commerce.
Problème décrit : « ${clip(body.message, 600)} »
Type : ${clip(body.type, 40)}. Panier moyen : ${n(body.panier)} €.
Estimation prudente de ce qu'il pourrait récupérer par mois : ${n(body.total)} € (${postes || "non chiffré"}).
Solution recommandée : ${clip(body.solution_recommandee, 80)}.${autres ? ` Ensuite : ${autres}.` : ""}
Écris une ou deux phrases (45 mots maximum) qui expliquent pourquoi cette solution répond à son problème, avec ses mots à lui. Ne répète pas les chiffres, ne donne aucun prix.`;
  }
  return null;
}

const logError = error => {
  if (error instanceof Anthropic.RateLimitError) console.warn("Caia: rate limited");
  else if (error instanceof Anthropic.APIError) console.error("Caia: API error", error.status);
  else console.error("Caia: unexpected error", error);
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ text: null });
  let body;
  try { body = await req.json(); } catch { return json({ error: "body" }, 400); }
  body = body || {};

  if (body.kind === "chat") {
    const messages = history(body.messages);
    if (!messages) return json({ error: "messages" }, 400);
    const ctx = clip(body.context, 200);
    const turn = Math.max(1, Math.min(50, Number(body.turn) || 1));
    const stage = body.lead
      ? "Le commerçant a déjà demandé à être rappelé : continue simplement à l'aider, sans reproposer le rappel."
      : turn === 1
        ? "C'est ta première réponse : épate-le avec une idée concrète, puis pose UNE question pour mieux connaître son commerce (métier, ville ou volume), ou propose déjà le rappel si sa demande est très concrète."
        : "Tu as déjà échangé avec lui : termine OBLIGATOIREMENT par la proposition de rappel par Nathan, reliée à ce qu'il vient de dire, en l'invitant à écrire son numéro ici ou à toucher « Être rappelé ».";
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let sent = false;
        try {
          const s = client.messages.stream({ ...FAST, max_tokens: 600, system: CHAT_SYSTEM + (ctx ? `\n\nCe que l'on sait déjà de ce commerce : ${ctx}.` : "") + `\n\nÉTAPE DE LA CONVERSATION : ${stage}`, messages });
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
              controller.enqueue(encoder.encode(event.delta.text)); sent = true;
            }
          }
          const final = await s.finalMessage();
          if (final.stop_reason === "refusal" && !sent) controller.enqueue(encoder.encode("Je préfère ne pas répondre à ça. Parlons plutôt de votre commerce : qu'est-ce qui vous prend le plus de temps en ce moment ?"));
        } catch (error) {
          logError(error);
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  }

  const content = shortPrompt(body);
  if (!content) return json({ error: "kind" }, 400);
  try {
    const response = await client.messages.create({ ...FAST, max_tokens: 300, system: SHORT_SYSTEM, messages: [{ role: "user", content }] });
    if (response.stop_reason === "refusal") return json({ text: null });
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    return json({ text: text ? text.slice(0, 600) : null });
  } catch (error) {
    logError(error);
    return json({ text: null });
  }
};

// Public endpoint: a fixed path, and a cap on requests per visitor so nobody can run up the bill.
// The page also limits each visitor to a set number of questions per day.
export const config = {
  path: "/api/caia",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
