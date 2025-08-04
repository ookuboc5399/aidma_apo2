
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function calculateAppointmentRate(client: string, filterValue: string, startDate: string, endDate: string, filterColumn: 'script_name' | 'list_name') {
    console.log(`[calculateAppointmentRate] Querying call_results for client: ${client}, ${filterColumn}: ${filterValue}, operating_date from ${startDate} to ${endDate}`);
    const { data, error } = await supabase
        .from('call_results')
        .select('call_count, appointment')
        .eq('client_name', client)
        .eq(filterColumn, filterValue)
        .gte('operating_date', startDate)
        .lt('operating_date', endDate)

    if (error) {
        console.error('[calculateAppointmentRate] Error fetching call_results:', error);
        throw error;
    }
    console.log('[calculateAppointmentRate] Fetched call_results data:', data);

    const stats = data.reduce((acc, cur) => {
        acc.totalCalls += cur.call_count;
        acc.appointments += cur.appointment;
        return acc;
    }, { totalCalls: 0, appointments: 0 });

    const rate = stats.totalCalls > 0 ? (stats.appointments / stats.totalCalls) * 100 : 0;
    return { totalCalls: stats.totalCalls, totalAppointments: stats.appointments, appointmentRate: rate.toFixed(2) };
}

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
        execution_date?: string; // 施策実施日を追加
        preMeasureStats?: { totalCalls: number; totalAppointments: number; appointmentRate: string } | null;
        postMeasureStats?: { totalCalls: number; totalAppointments: number; appointmentRate: string } | null;
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
            // アポ率データセット (折れ線グラフ)
            const rateDataPoints = Object.keys(aggregatedData.byScript[scriptName]).sort().map(date => ({
                x: date,
                y: (aggregatedData.byScript[scriptName][date].appointments / aggregatedData.byScript[scriptName][date].totalCalls * 100).toFixed(2)
            }));
            chartDataSets.push({
                label: `スクリプト: ${scriptName} (アポ率)`,
                data: rateDataPoints,
                borderColor: `#${Math.floor(Math.random()*16777215).toString(16)}`, // ランダムな色
                backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}80`, // ランダムな色（50%不透明）
                type: 'line', // 折れ線グラフ
                fill: false,
            });

            // 架電数データセット (棒グラフ)
            const callCountDataPoints = Object.keys(aggregatedData.byScript[scriptName]).sort().map(date => ({
                x: date,
                y: aggregatedData.byScript[scriptName][date].totalCalls.toString() // 架電数を文字列として渡す
            }));
            chartDataSets.push({
                label: `スクリプト: ${scriptName} (架電数)`,
                data: callCountDataPoints,
                borderColor: `#${Math.floor(Math.random()*16777215).toString(16)}`, // ランダムな色
                backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}80`, // ランダムな色（50%不透明）
                type: 'bar', // 棒グラフ
                fill: true, // 棒グラフなので塗りつぶし
            });
        });

        // list_nameごとのデータセットを生成
        Object.keys(aggregatedData.byList).forEach(listName => {
            // アポ率データセット (折れ線グラフ)
            const rateDataPoints = Object.keys(aggregatedData.byList[listName]).sort().map(date => ({
                x: date,
                y: (aggregatedData.byList[listName][date].appointments / aggregatedData.byList[listName][date].totalCalls * 100).toFixed(2)
            }));
            chartDataSets.push({
                label: `リスト: ${listName} (アポ率)`,
                data: rateDataPoints,
                borderColor: `#${Math.floor(Math.random()*16777215).toString(16)}`, // ランダムな色
                backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}80`, // ランダムな色（50%不透明）
                type: 'line', // 折れ線グラフ
                fill: false,
            });

            // 架電数データセット (棒グラフ)
            const callCountDataPoints = Object.keys(aggregatedData.byList[listName]).sort().map(date => ({
                x: date,
                y: aggregatedData.byList[listName][date].totalCalls.toString() // 架電数を文字列として渡す
            }));
            chartDataSets.push({
                label: `リスト: ${listName} (架電数)`,
                data: callCountDataPoints,
                borderColor: `#${Math.floor(Math.random()*16777215).toString(16)}`, // ランダムな色
                backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}80`, // ランダムな色（50%不透明）
                type: 'bar', // 棒グラフ
                fill: true, // 棒グラフなので塗りつぶし
            });
        });

        // 2. 期間内の施策情報を取得
        const { data: revisionsData, error: revisionsError } = await supabase
            .from('campaign_revisions')
            .select('execution_date, client_name, pre_fix_talk_list_name, post_fix_talk_list_name, deleted_list_name')
            .eq('client_name', client)
            .gte('execution_date', startDate.toISOString())
            .lt('execution_date', endDate.toISOString());

        if (revisionsError) throw revisionsError;
        console.log('Fetched campaign_revisions data:', revisionsData);

        const revisions = await Promise.all(revisionsData.map(async rev => {
            let measure_name = 'その他';
            if (rev.pre_fix_talk_list_name && rev.post_fix_talk_list_name) {
                measure_name = 'トーク改善';
            } else if (rev.deleted_list_name) {
                measure_name = '不要データ削除';
            } else if (rev.pre_fix_talk_list_name && rev.post_fix_talk_list_name && rev.deleted_list_name) {
                measure_name = '両方実施'; // 両方実施の場合
            }

            const executionDate = new Date(rev.execution_date);
            const monthStartDate = new Date(executionDate.getFullYear(), executionDate.getMonth(), 1);
            const monthEndDate = new Date(executionDate.getFullYear(), executionDate.getMonth() + 1, 0);

            let preMeasureStats = null;
            let postMeasureStats = null;

            if (measure_name === 'トーク改善' || measure_name === '両方実施') {
                // トーク改善の施策前後のアポ率計算
                // 施策前: 月初から施策実施日の前日まで
                preMeasureStats = await calculateAppointmentRate(
                    rev.client_name,
                    rev.pre_fix_talk_list_name || '',
                    monthStartDate.toISOString(),
                    executionDate.toISOString(),
                    'script_name'
                );
                // 施策後: 施策実施日から月末まで
                postMeasureStats = await calculateAppointmentRate(
                    rev.client_name,
                    rev.post_fix_talk_list_name || '',
                    executionDate.toISOString(),
                    monthEndDate.toISOString(),
                    'script_name'
                );
            } else if (measure_name === '不要データ削除') {
                // 不要データ削除の施策前後のアポ率計算
                // 施策前: 月初から施策実施日の前日まで
                preMeasureStats = await calculateAppointmentRate(
                    rev.client_name,
                    rev.deleted_list_name || '',
                    monthStartDate.toISOString(),
                    executionDate.toISOString(),
                    'list_name'
                );
                // 施策後: 施策実施日から月末まで
                postMeasureStats = await calculateAppointmentRate(
                    rev.client_name,
                    rev.deleted_list_name || '',
                    executionDate.toISOString(),
                    monthEndDate.toISOString(),
                    'list_name'
                );
            }

            return {
                execution_date: rev.execution_date,
                measure_name: measure_name,
                preMeasureStats: preMeasureStats,
                postMeasureStats: postMeasureStats,
                pre_fix_talk_list_name: rev.pre_fix_talk_list_name,
                post_fix_talk_list_name: rev.post_fix_talk_list_name,
                deleted_list_name: rev.deleted_list_name,
            };
        }));

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

            // 施策前後の情報を追加
            const relatedRevision = revisions.find(rev => 
                (rev.pre_fix_talk_list_name === scriptName || rev.post_fix_talk_list_name === scriptName)
            );

            scriptAggregates[scriptName] = {
                totalCalls: totalScriptCalls,
                totalAppointments: totalScriptAppointments,
                appointmentRate: totalScriptCalls > 0 ? ((totalScriptAppointments / totalScriptCalls) * 100).toFixed(2) : '0.00',
                execution_date: relatedRevision?.execution_date, // 施策実施日を追加
            };

            if (relatedRevision) {
                if (relatedRevision.pre_fix_talk_list_name === scriptName) {
                    scriptAggregates[scriptName].preMeasureStats = relatedRevision.preMeasureStats;
                }
                if (relatedRevision.post_fix_talk_list_name === scriptName) {
                    scriptAggregates[scriptName].postMeasureStats = relatedRevision.postMeasureStats;
                }
            }
        });

        const listAggregates: AggregatesType = {};
        Object.keys(aggregatedData.byList).forEach(listName => {
            let totalListCalls = 0;
            let totalListAppointments = 0;
            Object.keys(aggregatedData.byList[listName]).forEach(date => {
                totalListCalls += aggregatedData.byList[listName][date].totalCalls;
                totalListAppointments += aggregatedData.byList[listName][date].appointments;
            });

            // 施策前後の情報を追加
            const relatedRevision = revisions.find(rev => 
                rev.deleted_list_name === listName
            );

            listAggregates[listName] = {
                totalCalls: totalListCalls,
                totalAppointments: totalListAppointments,
                appointmentRate: totalListCalls > 0 ? ((totalListAppointments / totalListCalls) * 100).toFixed(2) : '0.00',
                execution_date: relatedRevision?.execution_date, // 施策実施日を追加
            };

            if (relatedRevision) {
                listAggregates[listName].preMeasureStats = relatedRevision.preMeasureStats;
                listAggregates[listName].postMeasureStats = relatedRevision.postMeasureStats;
            }
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
