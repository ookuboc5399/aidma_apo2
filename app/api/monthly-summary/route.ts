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
    return rate;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const month = searchParams.get('month'); // e.g., '2025-07'

        if (!month) {
            return NextResponse.json({ error: 'Month is required' }, { status: 400 });
        }

        const startDate = `${month}-01T00:00:00Z`;
        const endDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString();

        const { data: revisions, error: revisionsError } = await supabase
            .from('campaign_revisions')
            .select('*')
            .gte('execution_date', startDate)
            .lt('execution_date', endDate);

        if (revisionsError) throw revisionsError;
        console.log('Fetched campaign_revisions:', revisions);

        const summaryData = await Promise.all(revisions.map(async (rev) => {
            const executionDate = new Date(rev.execution_date);
            const preStartDate = new Date(executionDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30日前
            const postEndDate = new Date(executionDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30日後

            let talkImprovementPreRate = null;
            let talkImprovementPostRate = null;
            let talkImprovementDiff = null;

            if (rev.pre_fix_talk_list_name && rev.post_fix_talk_list_name) {
                try {
                    talkImprovementPreRate = await calculateAppointmentRate(rev.client_name, rev.pre_fix_talk_list_name, preStartDate, rev.execution_date, 'script_name');
                    talkImprovementPostRate = await calculateAppointmentRate(rev.client_name, rev.post_fix_talk_list_name, rev.execution_date, postEndDate, 'script_name');
                    talkImprovementDiff = (talkImprovementPostRate - talkImprovementPreRate).toFixed(2);
                } catch (e) {
                    console.error(`Error calculating talk improvement rates for ${rev.client_name}:`, e);
                }
            }

            let dataDeletionPreRate = null;
            let dataDeletionPostRate = null;
            let dataDeletionDiff = null;

            if (rev.deleted_list_name) {
                try {
                    // 不要データ削除の施策前後のアポ率計算
                    // 施策前: deleted_list_nameのリスト名で、execution_date以前のデータ
                    dataDeletionPreRate = await calculateAppointmentRate(rev.client_name, rev.deleted_list_name, preStartDate, rev.execution_date, 'list_name');
                    // 施策後: deleted_list_nameのリスト名で、execution_date以降のデータ
                    dataDeletionPostRate = await calculateAppointmentRate(rev.client_name, rev.deleted_list_name, rev.execution_date, postEndDate, 'list_name');
                    dataDeletionDiff = (dataDeletionPostRate - dataDeletionPreRate).toFixed(2);
                } catch (e) {
                    console.error(`Error calculating data deletion rates for ${rev.client_name}:`, e);
                }
            }

            let measure_name = 'その他';
            if (rev.pre_fix_talk_list_name && rev.post_fix_talk_list_name && rev.deleted_list_name) {
                measure_name = '両方実施';
            } else if (rev.pre_fix_talk_list_name && rev.post_fix_talk_list_name) {
                measure_name = 'トーク改善';
            } else if (rev.deleted_list_name) {
                measure_name = '不要データ削除';
            }

            return {
                client_name: rev.client_name,
                execution_date: rev.execution_date,
                measure_name: measure_name,
                // トーク改善のアポ率
                talk_improvement_pre_rate: talkImprovementPreRate !== null ? talkImprovementPreRate.toFixed(2) : null,
                talk_improvement_post_rate: talkImprovementPostRate !== null ? talkImprovementPostRate.toFixed(2) : null,
                talk_improvement_diff: talkImprovementDiff,
                // 不要データ削除のアポ率
                data_deletion_pre_rate: dataDeletionPreRate !== null ? dataDeletionPreRate.toFixed(2) : null,
                data_deletion_post_rate: dataDeletionPostRate !== null ? dataDeletionPostRate.toFixed(2) : null,
                data_deletion_diff: dataDeletionDiff,
                
                pre_fix_talk_list_name: rev.pre_fix_talk_list_name,
                post_fix_talk_list_name: rev.post_fix_talk_list_name,
                deleted_list_name: rev.deleted_list_name,
            };
        }));
        console.log('Calculated summaryData:', summaryData);

        return NextResponse.json(summaryData);

    } catch (error) {
        console.error('Error in monthly-summary API:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, { status: 500 });
    }
}