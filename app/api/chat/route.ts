
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json()

    // 質問解析とデータ取得のロジック（例：キーワードに基づいてSupabaseからデータを検索）
    let relevantData = []
    if (question.includes('アポ率') && question.includes('ユニクロ')) {
      // 例: ユニクロのアポ率に関するデータを取得
      const { data, error } = await supabase
        .from('call_results')
        .select('*')
        .eq('client_name', '株式会社ユニクロ')
        .limit(10)

      if (error) throw error
      relevantData = data
    }

    // ここにAIモデルを呼び出すロジックを実装します。
    // 取得したrelevantDataとquestionをAIモデルに渡し、回答を生成させます。
    // 現時点ではプレースホルダーとして固定のテキストを返します。
    const aiResponse = `
      ご質問: 「${question}」
      取得データ: ${JSON.stringify(relevantData, null, 2)}

      AIによる回答: このデータに基づいて、ご質問にお答えします。
      （例: 株式会社ユニクロの最近のアポ率は〇〇%です。）
    `

    return NextResponse.json({ answer: aiResponse })
  } catch (error) {
    console.error('Error in chat API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
