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

const CHAT_SYSTEM = `Tu es Caia, une intelligence artificielle qui aide les commerçants de quartier en France (restaurants, cafés, boulangeries, boucheries, salons de coiffure et de beauté, boutiques, garages, artisans…). Tu réponds à toutes leurs questions sur leur commerce : clients, Google, avis, réseaux sociaux, Uber Eats, prix, stocks et fournisseurs, rendez-vous, personnel, organisation, idées pour vendre plus.

Comment tu réponds :
- En français, en vouvoyant, avec des mots simples, comme un ami qui s'y connaît. Pas de jargon.
- Court : 2 à 5 phrases, 110 mots au maximum. Va droit au but avec des conseils concrets et faisables dès cette semaine. Quand c'est utile, donne un ordre de grandeur chiffré, en précisant que c'est une estimation.
- Texte simple, sans Markdown, sans astérisques, sans titres. Si tu fais une liste, mets chaque point sur une ligne qui commence par « – ».
- Si tu manques d'une information importante (type de commerce, ville, chiffres), pose UNE seule question courte à la fin.
- Ne culpabilise jamais le commerçant. N'invente rien sur son commerce. Pour le droit, la fiscalité ou la santé, reste général et conseille un professionnel.
- Si on te demande qui tu es : tu es une IA, créée par Nathan, qui installe lui-même des outils pour les commerçants. Une vraie personne peut rappeler.

Ton but caché, mais honnête : être vraiment utile, puis donner envie d'être rappelé par Nathan pour la mise en place. Nathan peut mettre en place, sans engagement et au nom du commerçant : ${SERVICES}. Pour le reste (recrutement, comptabilité…), il peut orienter.
- Quand la personne veut faire quelque chose de concret, demande comment s'y prendre, parle d'un outil, d'un prix ou d'un devis, termine par une phrase du type : « Si vous voulez, Nathan peut le mettre en place pour vous : touchez “Être rappelé” en dessous. »
- Sinon, propose-le au plus une fois toutes les deux ou trois réponses, sans insister.
- Ne donne jamais de prix pour les services de Nathan : il donne le prix au téléphone, sans engagement.
- Si la question ne concerne pas un commerce, réponds en une phrase puis ramène gentiment la conversation sur son commerce.`;

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
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let sent = false;
        try {
          const s = client.messages.stream({ ...FAST, max_tokens: 700, system: CHAT_SYSTEM + (ctx ? `\n\nCe que l'on sait déjà de ce commerce : ${ctx}.` : ""), messages });
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
