import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function calculateAppointmentRate(client: string, filterValue: string, startDate: string, endDate: string, filterColumn: 'script_name' | 'list_name'): Promise<number | null> {
    const { data, error } = await supabase
        .from('call_results')
        .select('call_count, appointment')
        .eq('client_name', client)
        .eq(filterColumn, filterValue)
        .gte('operating_date', startDate)
        .lt('operating_date', endDate)

    if (error) {
        console.error(`Error fetching call_results for ${client} and ${filterValue}:`, error);
        return null;
    }

    if (!data || data.length === 0) {
        return null;
    }

    const stats = data.reduce((acc, cur) => {
        acc.totalCalls += cur.call_count;
        acc.appointments += cur.appointment;
        return acc;
    }, { totalCalls: 0, appointments: 0 });

    if (stats.totalCalls === 0) {
        return null;
    }

    return (stats.appointments / stats.totalCalls) * 100;
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

        const summaryData = await Promise.all(revisions.map(async (rev) => {
            const executionDate = new Date(rev.execution_date);
            const monthStartDate = new Date(executionDate.getFullYear(), executionDate.getMonth(), 1).toISOString();
            const monthEndDate = new Date(executionDate.getFullYear(), executionDate.getMonth() + 1, 1).toISOString();

            let talkImprovementPreRate: number | null = null;
            let talkImprovementPostRate: number | null = null;
            let talkImprovementDiff: string | null = null;
            let dataDeletionPreRate: number | null = null;
            let dataDeletionPostRate: number | null = null;
            let dataDeletionDiff: string | null = null;

            // トーク改善のアポ率計算
            if (rev.pre_fix_talk_list_name) {
                talkImprovementPreRate = await calculateAppointmentRate(rev.client_name, rev.pre_fix_talk_list_name, monthStartDate, rev.execution_date, 'script_name');
            }
            if (rev.post_fix_talk_list_name) {
                talkImprovementPostRate = await calculateAppointmentRate(rev.client_name, rev.post_fix_talk_list_name, rev.execution_date, monthEndDate, 'script_name');
            }
            if (talkImprovementPreRate !== null && talkImprovementPostRate !== null) {
                talkImprovementDiff = (talkImprovementPostRate - talkImprovementPreRate).toFixed(2);
            }

            // 不要データ削除のアポ率計算
            if (rev.deleted_list_name) {
                dataDeletionPreRate = await calculateAppointmentRate(rev.client_name, rev.deleted_list_name, monthStartDate, rev.execution_date, 'list_name');
                dataDeletionPostRate = await calculateAppointmentRate(rev.client_name, rev.deleted_list_name, rev.execution_date, monthEndDate, 'list_name');
                if (dataDeletionPreRate !== null && dataDeletionPostRate !== null) {
                    dataDeletionDiff = (dataDeletionPostRate - dataDeletionPreRate).toFixed(2);
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