// Caia assistant: two short, fixed tasks for the public chat (never a general chatbot).
//   kind "reply": one warm sentence that shows the merchant was understood.
//   kind "diag":  two or three sentences that explain the estimate and what to do first.
// The API key stays on the server: set ANTHROPIC_API_KEY in Netlify > Site configuration > Environment variables.
// Without a key, or on any error, the page falls back to its own written answers.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `Tu es Caia, l'assistant d'une entreprise française qui installe des outils simples dans les commerces de quartier : accueil téléphonique par IA, commande à emporter sans commission, carte de fidélité sur téléphone, rappels de rendez-vous par SMS, avis Google, site internet, réseaux sociaux clés en main (tournage mensuel et publications Instagram ou TikTok).
Tu parles à des commerçants (restaurants, cafés, boulangeries, salons, boutiques). Tu vouvoies. Phrases courtes, chaleureuses, concrètes, sans jargon technique, sans emoji, sans liste.
Tu ne promets jamais de chiffre précis de gain, de délai ou de prix : un conseiller rappellera avec une proposition chiffrée.
Si le message ne parle pas d'un commerce, ramène poliment la conversation au commerce de la personne.`;

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function prompt(body) {
  if (body.kind === "reply") {
    const msg = clip(body.message, 1000);
    if (msg.length < 3) return null;
    return `Le commerçant vient d'écrire : « ${msg} »
Réponds en une ou deux phrases (40 mots maximum) pour montrer que tu as compris son problème et qu'il y a une solution. Ne pose aucune question : la question suivante est posée automatiquement après ta réponse.`;
  }
  if (body.kind === "diag") {
    const n = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : "?");
    const d = body.detail || {};
    const pistes = Array.isArray(body.pistes) ? body.pistes.slice(0, 3).map(p => clip(p, 60)).join(", ") : "";
    return `Diagnostic d'un commerce.
Problème décrit : « ${clip(body.message, 600)} »
Type : ${clip(body.type, 40)}. Panier moyen : ${n(body.panier)} €. Appels manqués par semaine : ${n(body.appels)}. Commandes par mois sur les plateformes : ${n(body.plateformes)}. Clients différents par mois : ${n(body.clients)}.
Estimation de pertes par mois : ${n(body.total)} € (appels manqués ${n(d.appels)} €, commissions ${n(d.commissions)} €, clients qui ne reviennent pas ${n(d.fidelite)} €).
Solutions retenues, dans l'ordre : ${pistes}.
Écris deux ou trois phrases (60 mots maximum) : la plus grosse fuite d'argent, et par quelle solution commencer et pourquoi. Ne répète pas tous les chiffres, ne donne aucun prix.`;
  }
  return null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ text: null });
  let body;
  try { body = await req.json(); } catch { return json({ error: "body" }, 400); }
  const content = prompt(body || {});
  if (!content) return json({ error: "kind" }, 400);
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return json({ text: null });
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    return json({ text: text ? text.slice(0, 600) : null });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.warn("Caia: rate limited");
    else if (error instanceof Anthropic.APIError) console.error("Caia: API error", error.status);
    else console.error("Caia: unexpected error", error);
    return json({ text: null });
  }
};

// Public endpoint: a fixed path, and a cap on requests per visitor so nobody can run up the bill.
export const config = {
  path: "/api/caia",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
