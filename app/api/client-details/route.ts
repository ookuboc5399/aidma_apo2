
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface AggregatedDataType {
    byScript: { [key: string]: { [key: string]: { totalCalls: number; appointments: number } } };
    byList: { [key: string]: { [key: string]: { totalCalls: number; appointments: number } } };
}

interface ChartDataSet {
    label: string;
    data: { x: string; y: string }[];
    borderColor: string;
    backgroundColor: string;
    type: string;
    fill: boolean;
    hidden?: boolean; // hiddenプロパティはオプション
}

interface AggregatesType {
    [key: string]: {
        totalCalls: number;
        totalAppointments: number;
        appointmentRate: string;
    };
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const client = searchParams.get('client');
        const month = searchParams.get('month'); // e.g., '2025-07'

        if (!client || !month) {
            return NextResponse.json({ error: 'Client and month are required' }, { status: 400 });
        }

        const startDate = new Date(`${month}-01T00:00:00Z`);
        const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));

        console.log(`[client-details] Querying daily call_results for client: ${client}, month: ${month}, from ${startDate.toISOString()} to ${endDate.toISOString()}`);
        // 1. 日毎のアポ率データを取得
        const { data: dailyData, error: dailyError } = await supabase
            .from('call_results')
            .select('operating_date, call_count, appointment, script_name, list_name') // list_nameも取得
            .eq('client_name', client)
            .gte('operating_date', startDate.toISOString())
            .lt('operating_date', endDate.toISOString())
            .order('operating_date', { ascending: true });

        if (dailyError) {
            console.error('[client-details] Error fetching daily call_results:', dailyError);
            throw dailyError;
        }
        console.log('[client-details] Fetched daily call_results data:', dailyData);

        // 日毎にscript_nameとlist_nameごとに集計
        const aggregatedData: AggregatedDataType = dailyData.reduce((acc: AggregatedDataType, cur) => {
            const date = cur.operating_date.split('T')[0]; // YYYY-MM-DD
            const scriptName = cur.script_name || '不明_script';
            const listName = cur.list_name || '不明_list';

            // script_nameごとの集計
            if (!acc.byScript[scriptName]) {
                acc.byScript[scriptName] = {};
            }
            if (!acc.byScript[scriptName][date]) {
                acc.byScript[scriptName][date] = { totalCalls: 0, appointments: 0 };
            }
            acc.byScript[scriptName][date].totalCalls += cur.call_count;
            acc.byScript[scriptName][date].appointments += cur.appointment;

            // list_nameごとの集計
            if (!acc.byList[listName]) {
                acc.byList[listName] = {};
            }
            if (!acc.byList[listName][date]) {
                acc.byList[listName][date] = { totalCalls: 0, appointments: 0 };
            }
            acc.byList[listName][date].totalCalls += cur.call_count;
            acc.byList[listName][date].appointments += cur.appointment;

            return acc;
        }, { byScript: {}, byList: {} });

        const chartDataSets: ChartDataSet[] = [];

        // script_nameごとのデータセットを生成
        Object.keys(aggregatedData.byScript).forEach(scriptName => {
            const dataPoints = Object.keys(aggregatedData.byScript[scriptName]).sort().map(date => ({
                x: date,
                y: (aggregatedData.byScript[scriptName][date].appointments / aggregatedData.byScript[scriptName][date].totalCalls * 100).toFixed(2)
            }));
            chartDataSets.push({
                label: `スクリプト: ${scriptName}`,
                data: dataPoints,
                borderColor: `#${Math.floor(Math.random()*16777215).toString(16)}`, // ランダムな色
                backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}80`, // ランダムな色（50%不透明）
                type: 'bar',
                fill: false,
            });
        });

        // list_nameごとのデータセットを生成
        Object.keys(aggregatedData.byList).forEach(listName => {
            const dataPoints = Object.keys(aggregatedData.byList[listName]).sort().map(date => ({
                x: date,
                y: (aggregatedData.byList[listName][date].appointments / aggregatedData.byList[listName][date].totalCalls * 100).toFixed(2)
            }));
            chartDataSets.push({
                label: `リスト: ${listName}`,
                data: dataPoints,
                borderColor: `#${Math.floor(Math.random()*16777215).toString(16)}`, // ランダムな色
                backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}80`, // ランダムな色（50%不透明）
                type: 'bar',
                fill: false,
                
            });
        });

        // 2. 期間内の施策情報を取得
        const { data: revisionsData, error: revisionsError } = await supabase
            .from('campaign_revisions')
            .select('execution_date, pre_fix_talk_list_name, post_fix_talk_list_name, deleted_list_name')
            .eq('client_name', client)
            .gte('execution_date', startDate.toISOString())
            .lt('execution_date', endDate.toISOString());

        if (revisionsError) throw revisionsError;
        console.log('Fetched campaign_revisions data:', revisionsData);

        const revisions = revisionsData.map(rev => {
            let measure_name = 'その他';
            if (rev.pre_fix_talk_list_name && rev.post_fix_talk_list_name) {
                measure_name = 'トーク改善';
            } else if (rev.deleted_list_name) {
                measure_name = '不要データ削除';
            } else if (rev.pre_fix_talk_list_name && rev.post_fix_talk_list_name && rev.deleted_list_name) {
                measure_name = '両方実施'; // 両方実施の場合
            }
            return {
                execution_date: rev.execution_date,
                measure_name: measure_name
            };
        });

        const totalAppointments = dailyData.reduce((sum, cur) => sum + cur.appointment, 0);
        const totalCalls = dailyData.reduce((sum, cur) => sum + cur.call_count, 0);
        const appointmentRate = totalCalls > 0 ? ((totalAppointments / totalCalls) * 100).toFixed(2) : '0.00';

        const scriptAggregates: AggregatesType = {};
        Object.keys(aggregatedData.byScript).forEach(scriptName => {
            let totalScriptCalls = 0;
            let totalScriptAppointments = 0;
            Object.keys(aggregatedData.byScript[scriptName]).forEach(date => {
                totalScriptCalls += aggregatedData.byScript[scriptName][date].totalCalls;
                totalScriptAppointments += aggregatedData.byScript[scriptName][date].appointments;
            });
            scriptAggregates[scriptName] = {
                totalCalls: totalScriptCalls,
                totalAppointments: totalScriptAppointments,
                appointmentRate: totalScriptCalls > 0 ? ((totalScriptAppointments / totalScriptCalls) * 100).toFixed(2) : '0.00'
            };
        });

        const listAggregates: AggregatesType = {};
        Object.keys(aggregatedData.byList).forEach(listName => {
            let totalListCalls = 0;
            let totalListAppointments = 0;
            Object.keys(aggregatedData.byList[listName]).forEach(date => {
                totalListCalls += aggregatedData.byList[listName][date].totalCalls;
                totalListAppointments += aggregatedData.byList[listName][date].appointments;
            });
            listAggregates[listName] = {
                totalCalls: totalListCalls,
                totalAppointments: totalListAppointments,
                appointmentRate: totalListCalls > 0 ? ((totalListAppointments / totalListCalls) * 100).toFixed(2) : '0.00'
            };
        });

        const response = {
            chartDataSets,
            revisions,
            totalAppointments,
            totalCalls,
            appointmentRate,
            scriptAggregates,
            listAggregates,
        };
        console.log('Final client-details response:', response);

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error in client-details API:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, { status: 500 });
    }
}
