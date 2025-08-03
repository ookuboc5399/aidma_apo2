
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL; // 環境変数からn8nのWebhook URLを取得
    console.log('[n8n-proxy] Received request.');

    if (!n8nWebhookUrl) {
      console.error('[n8n-proxy] n8n Webhook URL is not configured.');
      return NextResponse.json({ error: 'n8n Webhook URL is not configured' }, { status: 500 });
    }

    const body = await req.json();
    console.log('[n8n-proxy] Request body:', body);

    console.log(`[n8n-proxy] Forwarding request to n8n: ${n8nWebhookUrl}`);
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error(`[n8n-proxy] n8n webhook responded with error status ${n8nResponse.status}: ${errorText}`);
      throw new Error(`n8n webhook responded with status ${n8nResponse.status}: ${errorText}`);
    }

    const data = await n8nResponse.json();
    console.log('[n8n-proxy] Received response from n8n:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in n8n proxy API:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, { status: 500 });
  }
}
