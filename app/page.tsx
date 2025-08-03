'use client'

import { useState, useEffect } from 'react'
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
  LineElement
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

const MEASURE_COLORS = {
  'トーク改善': 'rgba(255, 99, 132, 0.8)',
  'スクリプト改善': 'rgba(54, 162, 235, 0.8)',
  '不要データ削除': 'rgba(255, 206, 86, 0.8)',
  '両方実施': 'rgba(153, 102, 255, 0.8)',
  'その他': 'rgba(75, 192, 192, 0.8)',
}

// --- Components ---

function MonthlySummary({ onClientSelect, month, setMonth, summaryData, fetchSummary }) {
  let lastClientName = null; // To keep track of the previous client name

  return (
    <div>
      <div className="flex items-end space-x-4 mb-6">
        <input 
          type="month" 
          value={month} 
          onChange={(e) => setMonth(e.target.value)} 
          className="border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
        />
        <button onClick={fetchSummary} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md shadow-md transition duration-200 ease-in-out">表示</button>
      </div>
      <div className="overflow-x-auto h-[calc(100vh-200px)] overflow-y-auto">
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
                    {(row.measure_name === 'トーク改善' || row.measure_name === '両方実施') && (
                      <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                        <span>修正前: {row.pre_fix_talk_list_name}</span><br/>
                        <span>修正後: {row.post_fix_talk_list_name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 border border-gray-200">
                    {(row.measure_name === '不要データ削除' || row.measure_name === '両方実施') && (
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

function ClientDetail({ client, month, onBack, measureType }) {
  const [chartData, setChartData] = useState(null)

  useEffect(() => {
    const fetchDetails = async () => {
      const response = await fetch(`/api/client-details?client=${client}&month=${month}`)
      const data = await response.json()
      
      const annotations = data.revisions.map(rev => ({
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
      const initialDatasets = data.chartDataSets.map(dataset => {
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
        labels: Array.from(new Set(data.chartDataSets.flatMap(dataset => dataset.data.map(d => d.x)))).sort(),
        datasets: initialDatasets,
        options: {
          plugins: {
            annotation: {
              annotations: annotations
            },
            legend: {
              onClick: (e, legendItem, legend) => {
                const index = legendItem.datasetIndex;
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
        }
      })
    }
    fetchDetails()
  }, [client, month, measureType])

  return (
    <div>
      <button onClick={onBack} className="mb-4 bg-gray-200 px-4 py-2 rounded">戻る</button>
      <h2 className="text-xl font-bold mb-2">{client} - アポ率推移</h2>
      <div style={{ width: '100%', height: '400px' }}>
        {chartData && <Bar data={chartData} options={chartData.options} />}
      </div>
    </div>
  )
}

// --- Main Page ---

export default function Home() {
  const [currentView, setCurrentView] = useState('summary') // 'summary' or 'detail'
  const [selectedClient, setSelectedClient] = useState(null)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [summaryData, setSummaryData] = useState([]); // Moved from MonthlySummary

  const fetchSummary = async () => { // Moved from MonthlySummary
    if (!month) return;
    const response = await fetch(`/api/monthly-summary?month=${month}`);
    const data = await response.json();
    if (response.ok) {
      // Sort data by execution_date first, then by client_name for consistent grouping
      const sortedData = data.sort((a, b) => {
        const dateA = new Date(a.execution_date).getTime();
        const dateB = new Date(b.execution_date).getTime();
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        return a.client_name.localeCompare(b.client_name);
      });
      setSummaryData(sortedData);
    } else {
      console.error('Failed to fetch summary data:', data.error);
      setSummaryData([]); // エラー時は空の配列にリセット
    }
  };

  useEffect(() => { // Fetch data when month changes or on initial mount
    fetchSummary();
  }, [month]);

  const handleClientSelect = (clientName, measureName) => {
    sessionStorage.setItem('scrollPosition', window.scrollY); // スクロール位置を保存
    setSelectedClient({ clientName, measureName })
    setCurrentView('detail')
  }

  const handleBackToSummary = () => {
    setSelectedClient(null)
    setCurrentView('summary')
    // スクロール位置を復元
    const scrollPosition = sessionStorage.getItem('scrollPosition');
    if (scrollPosition) {
      window.scrollTo(0, parseInt(scrollPosition));
      sessionStorage.removeItem('scrollPosition'); // 復元したら削除
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center py-12 px-4 bg-gray-50 text-gray-800">
      <div className="w-full max-w-7xl bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-8 text-center">施策効果測定ダッシュボード</h1>
        {currentView === 'summary' ? (
          <MonthlySummary 
            onClientSelect={handleClientSelect} 
            month={month} 
            setMonth={setMonth} 
            summaryData={summaryData} // Pass as prop
            fetchSummary={fetchSummary} // Pass as prop
          />
        ) : (
          <ClientDetail client={selectedClient.clientName} month={month} onBack={handleBackToSummary} measureType={selectedClient.measureName} />
        )}
      </div>
    </main>
  )
}