'use client'

//--- Components ---

interface SelectedClient {
  clientName: string;
  measureName: string;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

// --- Main Page ---

export default function Home() {
  const [currentView, setCurrentView] = useState('summary') // 'summary' or 'detail'
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [summaryData, setSummaryData] = useState<SummaryData[]>([]); // Moved from MonthlySummary
  const [reportContent, setReportContent] = useState(''); // レポート内容を保持
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [showChat, setShowChat] = useState(false); // チャットボットの表示状態
  const [messages, setMessages] = useState<Message[]>([]); // チャットメッセージ
  const [inputMessage, setInputMessage] = useState(''); // 入力中のメッセージ

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '') return;

    const newMessage: Message = { sender: 'user', text: inputMessage };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInputMessage('');

    try {
      // n8n Webhook URL (ここに実際のWebhook URLを設定してください)
      const n8nWebhookUrl = 'https://n8n-project-u47471.vm.elestio.app/webhook-test/92abcedb-f77d-4cf6-b90a-2c73463416dd'; 

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: inputMessage }),
      });

      if (response.ok) {
        const result = await response.json();
        setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: result.answer }]);
      } else {
        const errorData = await response.json();
        console.error('Failed to get chat response from n8n:', errorData.error);
        setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: `エラー: ${errorData.error}` }]);
      }
    } catch (error) {
      console.error('Error sending message to n8n:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: `エラー: ${errorMessage}` }]);
    }
  };

  const fetchSummary = useCallback(async () => { // Moved from MonthlySummary
    if (!month) return;
    
    try {
      const response = await fetch(`/api/monthly-summary?month=${month}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Sort data by execution_date first, then by client_name for consistent grouping
      const sortedData = (data as SummaryData[]).sort((a, b) => {
        const dateA = new Date(a.execution_date).getTime();
        const dateB = new Date(b.execution_date).getTime();
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        return a.client_name.localeCompare(b.client_name);
      });
      setSummaryData(sortedData);
    } catch (error) {
      console.error('Failed to fetch summary data:', error);
      setSummaryData([]); // エラー時は空の配列にリセット
    }
  }, [month]);

  useEffect(() => { // Fetch data when month changes or on initial mount
    fetchSummary();
  }, [month, fetchSummary]);

  const handleGenerateReport = useCallback(async () => {
    setIsReportLoading(true);
    setReportContent('');
    // 現在表示されているサマリーデータと、必要であれば詳細データを収集
    const dataToSend = {
      summaryData: summaryData,
      // clientDetailsData: ... // 必要であれば、ここに詳細データを追加
    };

    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        const result = await response.json();
        setReportContent(result.report);
      } else {
        const errorData = await response.json();
        console.error('Failed to generate report:', errorData.error);
        setReportContent(`レポート生成に失敗しました: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setReportContent(`レポート生成中にエラーが発生しました: ${errorMessage}`);
    } finally {
      setIsReportLoading(false);
    }
  }, [summaryData]);

  useEffect(() => {
    if (isReportModalOpen) {
      handleGenerateReport();
    }
  }, [isReportModalOpen, handleGenerateReport]);

  const handleClientSelect = (clientName: string, measureName: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('scrollPosition', String(window.scrollY)); // スクロール位置を保存
    }
    setSelectedClient({ clientName, measureName })
    setCurrentView('detail')
  }

  const handleBackToSummary = () => {
    setSelectedClient(null)
    setCurrentView('summary')
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-800">
      <div className="w-full max-w-full mx-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">施策効果測定ダッシュボード</h1>
          <div className="flex items-center space-x-4">
            <button 
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="flex items-center space-x-2 bg-white hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow-sm border border-gray-300 transition duration-200 ease-in-out cursor-pointer"
            >
              <LogOut className="h-5 w-5" />
              <span>ログアウト</span>
            </button>
          </div>
        </header>
        
        <div className="bg-white shadow-xl rounded-lg p-8">
          {currentView === 'summary' ? (
            <MonthlySummary 
              onClientSelect={handleClientSelect} 
              month={month} 
              setMonth={setMonth} 
              summaryData={summaryData}
              fetchSummary={fetchSummary}
              onGenerateReportClick={() => setIsReportModalOpen(true)}
            />
          ) : selectedClient ? (
            <ClientDetail 
              client={selectedClient.clientName} 
              month={month} 
              onBack={handleBackToSummary} 
              measureType={selectedClient.measureName} 
            />
          ) : null}
        </div>
      </div>
      
      <ReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)}
        title="生成されたレポート"
        reportContent={reportContent}
      >
        {isReportLoading ? (
          <div className="flex justify-center items-center h-48">
            <p className="text-lg">レポートを生成中です...</p>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">
            {reportContent}
          </div>
        )}
      </ReportModal>
      
      {/* Chatbot UI */}
      <div className="fixed bottom-4 right-4 z-50">
        <button 
          onClick={() => setShowChat(!showChat)} 
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
        {showChat && (
          <div className="bg-white rounded-lg shadow-xl w-80 h-96 flex flex-col mt-2">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold">AIチャットボット</h3>
              <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {messages.map((msg, index) => (
                <div key={index} className={`mb-2 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block p-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                    {msg.text}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 flex">
              <input 
                type="text" 
                className="flex-1 border border-gray-300 rounded-l-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="質問を入力..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
              />
              <button 
                onClick={handleSendMessage} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-md"
              >
                送信
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic'
import { LogOut } from 'lucide-react';
import { Chart } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  PointElement,
  LineElement,
  ChartOptions,
  LegendItem,
  ChartEvent,
  LineController,   // ← これを追加！
  BarController,
  ChartDataset
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import 'chartjs-adapter-date-fns'

const ReportModal = dynamic(() => import('./components/ReportModal'), { ssr: false });

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  PointElement,
  LineElement,
  annotationPlugin,
  LineController, 
  BarController 
)

interface SummaryData {
  client_name: string;
  execution_date: string;
  measure_name: string;
  talk_improvement_pre_rate: string | null;
  talk_improvement_post_rate: string | null;
  talk_improvement_diff: string | null;
  data_deletion_pre_rate: string | null;
  data_deletion_post_rate: string | null;
  data_deletion_diff: string | null;
  pre_fix_talk_list_name: string | null;
  post_fix_talk_list_name: string | null;
  deleted_list_name: string | null;
}

const MEASURE_COLORS: { [key: string]: string } = {
  'トーク改善': 'rgba(255, 99, 132, 0.8)',
  'スクリプト改善': 'rgba(54, 162, 235, 0.8)',
  '不要データ削除': 'rgba(255, 206, 86, 0.8)',
  '両方実施': 'rgba(153, 102, 255, 0.8)',
  'その他': 'rgba(75, 192, 192, 0.8)',
}

// --- Components ---

interface MonthlySummaryProps {
  onClientSelect: (clientName: string, measureName: string) => void;
  month: string;
  setMonth: (month: string) => void;
  summaryData: SummaryData[];
  fetchSummary: () => void;
  onGenerateReportClick: () => void;
}

function MonthlySummary({ onClientSelect, month, setMonth, summaryData, fetchSummary, onGenerateReportClick }: MonthlySummaryProps) {
  let lastClientName: string | null = null;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const scrollPosition = sessionStorage.getItem('scrollPosition');
      if (scrollPosition && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = parseInt(scrollPosition);
        sessionStorage.removeItem('scrollPosition');
      }
    }
  }, [summaryData]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)} 
            className="border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm text-base"
          />
          <button onClick={fetchSummary} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">表示</button>
        </div>
        <button 
          onClick={onGenerateReportClick} 
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
        >
          レポート生成
        </button>
      </div>
      <div ref={scrollContainerRef} className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">クライアント</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">施策日</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">施策名</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">トーク改善 施策前 アポ率(%)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">トーク改善 施策後 アポ率(%)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">トーク改善 差分</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">不要データ削除 施策前 アポ率(%)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">不要データ削除 施策後 アポ率(%)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">不要データ削除 差分</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">トーク改善施策詳細</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">不要データ削除施策詳細</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {summaryData.map((row, i) => {
              const displayClientName = row.client_name === lastClientName ? '' : row.client_name;
              lastClientName = row.client_name;
              return (
                <tr key={i} onClick={() => onClientSelect(row.client_name, row.measure_name)} className="hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50">{displayClientName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(row.execution_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.measure_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.talk_improvement_pre_rate !== null ? `${row.talk_improvement_pre_rate}%` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.talk_improvement_post_rate !== null ? `${row.talk_improvement_post_rate}%` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.talk_improvement_diff !== null ? `${row.talk_improvement_diff}%` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.data_deletion_pre_rate !== null ? `${row.data_deletion_pre_rate}%` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.data_deletion_post_rate !== null ? `${row.data_deletion_post_rate}%` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.data_deletion_diff !== null ? `${row.data_deletion_diff}%` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(row.pre_fix_talk_list_name || row.post_fix_talk_list_name) && (
                      <div>
                        <span>修正前: {row.pre_fix_talk_list_name}</span><br/>
                        <span>修正後: {row.post_fix_talk_list_name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row.deleted_list_name && (
                      <div>
                        <span>使用中リスト名: {row.deleted_list_name}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ClientDetailProps {
  client: string;
  month: string;
  onBack: () => void;
  measureType: string;
}

interface AggregatesType {
  [key: string]: {
    totalCalls: number;
    totalAppointments: number;
    appointmentRate: string;
    preMeasureStats?: {
      execution_date: string;
      totalCalls: number;
      totalAppointments: number;
      appointmentRate: string;
    };
    postMeasureStats?: {
      execution_date: string;
      totalCalls: number;
      totalAppointments: number;
      appointmentRate: string;
    };
  };
}

interface ChartDataPoint {
  x: string;
  y: string;
}

interface ChartDataSet {
  label: string;
  data: ChartDataPoint[];
  type: 'line' | 'bar';
  yAxisID: 'y' | 'y1';
  hidden?: boolean;
}

interface ChartDetailsResponse {
  revisions: CampaignRevision[];
  chartDataSets: ChartDataSet[];
  totalAppointments: number;
  totalCalls: number;
  appointmentRate: string;
  scriptAggregates: AggregatesType;
  listAggregates: AggregatesType;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset<'bar' | 'line', { x: string; y: string }[]>[];
  options: ChartOptions<'bar' | 'line'>;
  totalAppointments: number;
  totalCalls: number;
  appointmentRate: string;
  scriptAggregates: AggregatesType;
  listAggregates: AggregatesType;
}

interface CampaignRevision {
  id: number;
  created_at: string;
  client_name: string;
  execution_date: string;
  measure_name: string;
  pre_fix_talk_list_name: string | null;
  post_fix_talk_list_name: string | null;
  deleted_list_name: string | null;
}

function ClientDetail({ client, month, onBack, measureType }: ClientDetailProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null)

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(`/api/client-details?client=${encodeURIComponent(client)}&month=${month}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: ChartDetailsResponse = await response.json()
        
        const annotations = data.revisions.map((rev: CampaignRevision) => ({
          type: 'line' as const,
          scaleID: 'x',
          value: new Date(rev.execution_date).setHours(0, 0, 0, 0),
          borderColor: MEASURE_COLORS[rev.measure_name] || MEASURE_COLORS['その他'],
          borderWidth: 2,
          label: {
            content: rev.measure_name,
            enabled: true,
            position: 'start' as const
          }
        }))

        // 施策タイプに基づいてデータセットの表示/非表示を初期設定
        const initialDatasets = data.chartDataSets.map((dataset: ChartDataSet) => {
          const newDataset = { ...dataset };
          if (newDataset.type === 'line') {
            newDataset.yAxisID = 'y'; // アポ率 (折れ線グラフ) は左Y軸
          } else if (newDataset.type === 'bar') {
            newDataset.yAxisID = 'y1'; // 架電数 (棒グラフ) は右Y軸
          }

          if (measureType === '不要データ削除' && newDataset.label.startsWith('リスト:')) {
            return { ...newDataset, hidden: false }; // 不要データ削除ならリストを表示
          } else if (measureType === 'トーク改善' && newDataset.label.startsWith('スクリプト:')) {
            return { ...newDataset, hidden: false }; // トーク改善ならスクリプトを表示
          } else if (measureType === '両方実施') {
            // 両方実施の場合は、両方のデータセットを表示
            return { ...newDataset, hidden: false };
          } else {
            // その他の場合は、デフォルトでスクリプトを表示し、リストは非表示
            if (newDataset.label.startsWith('スクリプト:')) {
              return { ...newDataset, hidden: false };
            } else if (newDataset.label.startsWith('リスト:')) {
              return { ...newDataset, hidden: true };
            } else {
              return { ...newDataset, hidden: true };
            }
          }
        });

        setChartData({
          labels: Array.from(new Set(data.chartDataSets.flatMap((dataset: ChartDataSet) => dataset.data.map((d: ChartDataPoint) => d.x)))).sort() as string[],
          datasets: initialDatasets,
          options: {
            plugins: {
              annotation: {
                annotations: annotations
              },
              legend: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick: (e: ChartEvent, legendItem: LegendItem, legend: any) => {
                  const index = legendItem.datasetIndex;
                  if (index === undefined) return;
                  const ci = legend.chart;
                  const meta = ci.getDatasetMeta(index);

                  // Toggle visibility
                  meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;

                  ci.update();
                }
              }
            },
            scales: {
              x: {
                type: 'time' as const,
                time: {
                  unit: 'day' as const
                }
              },
              y: {
                type: 'linear' as const,
                display: true,
                position: 'left' as const,
                title: {
                  display: true,
                  text: 'アポ率 (%)'
                }
              },
              y1: {
                type: 'linear' as const,
                display: true,
                position: 'right' as const,
                grid: {
                  drawOnChartArea: false,
                },
                title: {
                  display: true,
                  text: '架電数'
                }
              }
            }
          },
          totalAppointments: data.totalAppointments,
          totalCalls: data.totalCalls,
          appointmentRate: data.appointmentRate,
          scriptAggregates: data.scriptAggregates || {},
          listAggregates: data.listAggregates || {},
        })
      } catch (error) {
        console.error('Error fetching client details:', error);
        // エラーハンドリング: デフォルトのchartDataを設定するか、エラー状態を表示
      }
    }
    fetchDetails()
  }, [client, month, measureType])

  return (
    <div className="flex flex-col flex-grow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{client} - アポ率推移</h2>
        <button onClick={onBack} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">戻る</button>
      </div>
      {chartData && (
        <div className="flex flex-grow -mx-4">
          <div className="w-2/3 px-4 h-full">
            <div className="bg-white p-4 rounded-lg shadow-md h-full">
              <Chart 
                type='bar'
                data={chartData} 
                options={chartData.options} 
              />
            </div>
          </div>
          <div className="w-1/3 px-4">
            <div className="bg-gray-50 p-4 rounded-lg shadow-inner h-full overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-300">期間合計</h3>
              <div className="space-y-2 mb-4">
                <p><strong>合計アポイント数:</strong> {chartData.totalAppointments}</p>
                <p><strong>合計架電数:</strong> {chartData.totalCalls}</p>
                <p><strong>アポ率:</strong> {chartData.appointmentRate}%</p>
              </div>

              {(measureType === 'トーク改善' || measureType === '両方実施') && chartData.scriptAggregates && Object.keys(chartData.scriptAggregates).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <h4 className="text-md font-semibold mb-2">スクリプト別集計</h4>
                  {Object.entries(chartData.scriptAggregates).map(([scriptName, metrics]) => (
                    <div key={scriptName} className="mb-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                      <p className="font-bold text-gray-700">{scriptName}:</p>
                      <div className="pl-2 mt-1 space-y-1 text-sm">
                        <p>アポイント数: {metrics.totalAppointments}</p>
                        <p>架電数: {metrics.totalCalls}</p>
                        <p>アポ率: {metrics.appointmentRate}%</p>
                        {metrics.preMeasureStats && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-semibold text-xs text-gray-500">施策前 ({new Date(metrics.preMeasureStats.execution_date).toLocaleDateString()}まで):</p>
                            <p className="pl-2">アポイント数: {metrics.preMeasureStats.totalAppointments}</p>
                            <p className="pl-2">架電数: {metrics.preMeasureStats.totalCalls}</p>
                            <p className="pl-2">アポ率: {metrics.preMeasureStats.appointmentRate}%</p>
                          </div>
                        )}
                        {metrics.postMeasureStats && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-semibold text-xs text-gray-500">施策後 ({new Date(metrics.postMeasureStats.execution_date).toLocaleDateString()}から):</p>
                            <p className="pl-2">アポイント数: {metrics.postMeasureStats.totalAppointments}</p>
                            <p className="pl-2">架電数: {metrics.postMeasureStats.totalCalls}</p>
                            <p className="pl-2">アポ率: {metrics.postMeasureStats.appointmentRate}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(measureType === '不要データ削除' || measureType === '両方実施') && chartData.listAggregates && Object.keys(chartData.listAggregates).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <h4 className="text-md font-semibold mb-2">リスト別集計</h4>
                  {Object.entries(chartData.listAggregates).map(([listName, metrics]) => (
                    <div key={listName} className="mb-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                      <p className="font-bold text-gray-700">{listName}:</p>
                      <div className="pl-2 mt-1 space-y-1 text-sm">
                        <p>アポイント数: {metrics.totalAppointments}</p>
                        <p>架電数: {metrics.totalCalls}</p>
                        <p>アポ率: {metrics.appointmentRate}%</p>
                        {metrics.preMeasureStats && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-semibold text-xs text-gray-500">施策前 ({new Date(metrics.preMeasureStats.execution_date).toLocaleDateString()}まで):</p>
                            <p className="pl-2">アポイント数: {metrics.preMeasureStats.totalAppointments}</p>
                            <p className="pl-2">架電数: {metrics.preMeasureStats.totalCalls}</p>
                            <p className="pl-2">アポ率: {metrics.preMeasureStats.appointmentRate}%</p>
                          </div>
                        )}
                        {metrics.postMeasureStats && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-semibold text-xs text-gray-500">施策後 ({new Date(metrics.postMeasureStats.execution_date).toLocaleDateString()}から):</p>
                            <p className="pl-2">アポイント数: {metrics.postMeasureStats.totalAppointments}</p>
                            <p className="pl-2">架電数: {metrics.postMeasureStats.totalCalls}</p>
                            <p className="pl-2">アポ率: {metrics.postMeasureStats.appointmentRate}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

//