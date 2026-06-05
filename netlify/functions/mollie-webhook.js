// netlify/functions/mollie-webhook.js
// =====================================================================
// Mollie webhook — verwerkt betaalbevestigingen
// =====================================================================
// Mollie roept deze URL aan wanneer een betaling statuswijziging heeft.
// Hier sla je de betaling op in je database (bv. Supabase / FaunaDB).
// =====================================================================

const { createMollieClient } = require('@mollie/api-client');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const params = new URLSearchParams(event.body);
    const paymentId = params.get('id');

    if (!paymentId) {
      return { statusCode: 400, body: 'Geen payment ID' };
    }

    const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
    const payment = await mollie.payments.get(paymentId);

    console.log(`Betaling ${paymentId}: ${payment.status}`);

    if (payment.status === 'paid') {
      const { naam, email, spots } = payment.metadata;
      const spotList = spots.split(',');

      // TODO: Sla hier de reservatie op in je database
      // Voorbeeld met Supabase:
      //
      // const { createClient } = require('@supabase/supabase-js');
      // const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      // await supabase.from('reservaties').insert({
      //   naam, email,
      //   spots: spotList,
      //   betaald: true,
      //   mollie_id: paymentId,
      //   bedrag: parseFloat(payment.amount.value),
      //   timestamp: new Date().toISOString(),
      // });

      // TODO: Stuur bevestigingsmail via bv. SendGrid of Mailgun
      // await sendConfirmationEmail(email, naam, spotList);

      console.log(`✅ Reservatie bevestigd voor ${naam} (${email}): ${spots}`);
    }

    return { statusCode: 200, body: '' };

  } catch (err) {
    console.error('Webhook fout:', err);
    return { statusCode: 500, body: 'Interne fout' };
  }
};
