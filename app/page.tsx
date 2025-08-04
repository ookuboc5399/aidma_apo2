'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic'

const ReportModal = dynamic(() => import('./components/ReportModal'), { ssr: false });
import { Bar } from 'react-chartjs-2'
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
  ChartEvent
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import 'chartjs-adapter-date-fns'

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
  annotationPlugin
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
  let lastClientName: string | null = null; // To keep track of the previous client name
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollPosition = sessionStorage.getItem('scrollPosition');
    if (scrollPosition && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = parseInt(scrollPosition);
      sessionStorage.removeItem('scrollPosition');
    }
  }, [summaryData]); // summaryDataが更新されたときに実行

  return (
    <div>
      <div className="flex items-end space-x-4 mb-6">
        <input 
          type="month" 
          value={month} 
          onChange={(e) => setMonth(e.target.value)} 
          className="border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
        />
        <button onClick={fetchSummary} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md shadow-md transition duration-200 ease-in-out cursor-pointer">表示</button>
        <button 
          onClick={onGenerateReportClick} 
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md shadow-md transition duration-200 ease-in-out text-sm cursor-pointer"
        >
          レポート生成
        </button>
      </div>
      <div ref={scrollContainerRef} className="overflow-x-auto h-[calc(100vh-200px)] overflow-y-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">クライアント</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">施策日</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">施策名</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">トーク改善 施策前 アポ率(%)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">トーク改善 施策後 アポ率(%)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">トーク改善 差分</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">不要データ削除 施策前 アポ率(%)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">不要データ削除 施策後 アポ率(%)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">不要データ削除 差分</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">トーク改善施策詳細</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border border-gray-200">不要データ削除施策詳細</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.map((row, i) => {
              const displayClientName = row.client_name === lastClientName ? '' : row.client_name;
              lastClientName = row.client_name;
              return (
                <tr key={i} onClick={() => onClientSelect(row.client_name, row.measure_name)} className="border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition duration-150 ease-in-out">
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{displayClientName}</td>
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{new Date(row.execution_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{row.measure_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{row.talk_improvement_pre_rate !== null ? `${row.talk_improvement_pre_rate}%` : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{row.talk_improvement_post_rate !== null ? `${row.talk_improvement_post_rate}%` : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{row.talk_improvement_diff !== null ? `${row.talk_improvement_diff}%` : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{row.data_deletion_pre_rate !== null ? `${row.data_deletion_pre_rate}%` : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{row.data_deletion_post_rate !== null ? `${row.data_deletion_post_rate}%` : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis border border-gray-200">{row.data_deletion_diff !== null ? `${row.data_deletion_diff}%` : '-'}</td>
                  <td className="px-4 py-3 border border-gray-200">
                    {(row.pre_fix_talk_list_name || row.post_fix_talk_list_name) && (
                      <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                        <span>修正前: {row.pre_fix_talk_list_name}</span><br/>
                        <span>修正後: {row.post_fix_talk_list_name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 border border-gray-200">
                    {row.deleted_list_name && (
                      <div className="whitespace-nowrap overflow-hidden text-ellipsis">
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
    };
}

interface ChartData {
  labels: string[];
  datasets: ChartDataSet[];
  options: ChartOptions<'bar'>; // optionsは複雑なので一旦any
  totalAppointments: number;
  totalCalls: number;
  appointmentRate: string;
  scriptAggregates: AggregatesType; // scriptAggregatesも一旦any
  listAggregates: AggregatesType; // listAggregatesも一旦any
}

interface ChartDataSet {
    label: string;
    data: { x: string; y: string }[];
    borderColor: string;
    backgroundColor: string;
    type: 'bar';
    fill: boolean;
    hidden?: boolean; // hiddenプロパティはオプション
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
      const response = await fetch(`/api/client-details?client=${client}&month=${month}`)
      const data = await response.json()
      
      const annotations = data.revisions.map((rev: CampaignRevision) => ({
        type: 'line',
        scaleID: 'x',
        value: new Date(rev.execution_date).setHours(0, 0, 0, 0),
        borderColor: MEASURE_COLORS[rev.measure_name] || MEASURE_COLORS['その他'],
        borderWidth: 2,
        label: {
          content: rev.measure_name,
          enabled: true,
          position: 'top'
        }
      }))

      // 施策タイプに基づいてデータセットの表示/非表示を初期設定
      const initialDatasets = data.chartDataSets.map((dataset: ChartDataSet) => {
        if (measureType === '不要データ削除' && dataset.label.startsWith('リスト:')) {
          return { ...dataset, hidden: false }; // 不要データ削除ならリストを表示
        } else if (measureType === 'トーク改善' && dataset.label.startsWith('スクリプト:')) {
          return { ...dataset, hidden: false }; // トーク改善ならスクリプトを表示
        } else if (measureType === '両方実施') {
          // 両方実施の場合は、両方のデータセットを表示
          return { ...dataset, hidden: false };
        } else {
          // その他の場合は、デフォルトでスクリプトを表示し、リストは非表示
          if (dataset.label.startsWith('スクリプト:')) {
            return { ...dataset, hidden: false };
          } else if (dataset.label.startsWith('リスト:')) {
            return { ...dataset, hidden: true };
          } else {
            return { ...dataset, hidden: true };
          }
        }
      });

      setChartData({
        labels: Array.from(new Set(data.chartDataSets.flatMap((dataset: ChartDataSet) => dataset.data.map(d => d.x)))).sort() as string[],
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
              type: 'time',
              time: {
                unit: 'day'
              }
            }
          }
        },
        totalAppointments: data.totalAppointments,
        totalCalls: data.totalCalls,
        appointmentRate: data.appointmentRate,
        scriptAggregates: data.scriptAggregates,
        listAggregates: data.listAggregates,
      })
    }
    fetchDetails()
  }, [client, month, measureType])

  return (
    <div className="flex flex-col flex-grow">
      <button onClick={onBack} className="mb-4 bg-gray-200 px-2 py-1 rounded text-sm inline-block">戻る</button>
      <h2 className="text-xl font-bold mb-2">{client} - アポ率推移</h2>
      {chartData && (
        <div className="flex flex-grow">
          <div className="w-2/3 h-full">
            <Bar data={chartData} options={chartData.options} />
          </div>
          <div className="w-1/3 ml-4 p-4 border rounded-lg shadow-md bg-gray-50 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2">期間合計</h3>
            <p><strong>合計アポイント数:</strong> {chartData.totalAppointments}</p>
            <p><strong>合計架電数:</strong> {chartData.totalCalls}</p>
            <p><strong>アポ率:</strong> {chartData.appointmentRate}%</p>

            {(measureType === 'トーク改善' || measureType === '両方実施') && chartData.scriptAggregates && Object.keys(chartData.scriptAggregates).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <h4 className="text-md font-semibold mb-2">スクリプト別集計</h4>
                {Object.entries(chartData.scriptAggregates).map(([scriptName, metrics]) => (
                  <div key={scriptName} className="mb-2 p-2 border border-gray-200 rounded-md bg-white">
                    <p><strong>{scriptName}:</strong></p>
                    <p className="ml-2">アポイント数: {metrics.totalAppointments}</p>
                    <p className="ml-2">架電数: {metrics.totalCalls}</p>
                    <p className="ml-2">アポ率: {metrics.appointmentRate}%</p>
                  </div>
                ))}
              </div>
            )}

            {(measureType === '不要データ削除' || measureType === '両方実施') && chartData.listAggregates && Object.keys(chartData.listAggregates).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <h4 className="text-md font-semibold mb-2">リスト別集計</h4>
                {Object.entries(chartData.listAggregates).map(([listName, metrics]) => (
                  <div key={listName} className="mb-2 p-2 border border-gray-200 rounded-md bg-white">
                    <p><strong>{listName}:</strong></p>
                    <p className="ml-2">アポイント数: {metrics.totalAppointments}</p>
                    <p className="ml-2">架電数: {metrics.totalCalls}</p>
                    <p className="ml-2">アポ率: {metrics.appointmentRate}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}



// --- Components ---


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
    const response = await fetch(`/api/monthly-summary?month=${month}`);
    const data = await response.json();
    if (response.ok) {
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
    } else {
      console.error('Failed to fetch summary data:', (data as { error: string }).error);
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
    sessionStorage.setItem('scrollPosition', String(window.scrollY)); // スクロール位置を保存
    setSelectedClient({ clientName, measureName })
    setCurrentView('detail')
  }

  const handleBackToSummary = () => {
    setSelectedClient(null)
    setCurrentView('summary')
  }

  return (
    <main className="flex min-h-screen flex-col items-center py-12 px-4 bg-purple-800 text-gray-800 relative">
      <div className="w-full max-w-full bg-white shadow-lg rounded-lg p-8 flex flex-col flex-grow">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-8 text-center">施策効果測定ダッシュボード</h1>
        <button 
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/login'; // ログアウト後にログインページへリダイレクト
          }}
          className="mb-6 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md shadow-md transition duration-200 ease-in-out"
        >
          ログアウト
        </button>
        
        {currentView === 'summary' ? (
          <MonthlySummary 
            onClientSelect={handleClientSelect} 
            month={month} 
            setMonth={setMonth} 
            summaryData={summaryData} // Pass as prop
            fetchSummary={fetchSummary} // Pass as prop
            onGenerateReportClick={() => setIsReportModalOpen(true)} // Pass the function
          />
        ) : selectedClient ? (
          <ClientDetail client={selectedClient.clientName} month={month} onBack={handleBackToSummary} measureType={selectedClient.measureName} />
        ) : null}
      </div>
      <ReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)}
        title="生成されたレポート"
        reportContent={reportContent}
      >
        {isReportLoading ? (
          <div className="flex justify-center items-48">
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




