// netlify/functions/create-payment.js
// =====================================================================
// Mollie betaallink aanmaken — server-side (veilig)
// =====================================================================
// Installatie:
//   npm install @mollie/api-client
//
// Stel in Netlify dashboard (Site settings > Environment variables):
//   MOLLIE_API_KEY = live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   URL            = https://jouw-site.netlify.app
// =====================================================================

const { createMollieClient } = require('@mollie/api-client');

exports.handler = async (event) => {
  // Alleen POST toestaan
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = JSON.parse(event.body);
    const { naam, email, spots, bedrag } = body;

    // Validatie
    if (!naam || !email || !spots || !bedrag) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Ontbrekende verplichte velden' }),
      };
    }

    if (bedrag < 1 || bedrag > 50) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Ongeldig bedrag' }),
      };
    }

    // Mollie client aanmaken
    const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

    // Betaling aanmaken
    const payment = await mollie.payments.create({
      amount: {
        currency: 'EUR',
        value: bedrag.toFixed(2),  // Mollie vereist string met 2 decimalen
      },
      description: `Rommelmarkt 2025 — Standplaats(en) ${spots.join(', ')}`,
      redirectUrl: `${process.env.URL}/betaling-ok.html?spots=${spots.join('+')}`,
      webhookUrl: `${process.env.URL}/.netlify/functions/mollie-webhook`,
      metadata: {
        naam,
        email,
        spots: spots.join(','),
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        checkoutUrl: payment.getCheckoutUrl(),
        paymentId: payment.id,
      }),
    };

  } catch (err) {
    console.error('Mollie fout:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Betalingsfout — probeer opnieuw' }),
    };
  }
};
