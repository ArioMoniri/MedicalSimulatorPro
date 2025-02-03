import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export interface VitalSigns {
  hr?: number;  // Heart rate
  bp?: { systolic: number; diastolic: number };  // Blood pressure
  rr?: number;  // Respiratory rate
  spo2?: number;  // SpO2
  temp?: number;  // Temperature
}

interface VitalSignsMonitorProps {
  latestVitals: VitalSigns;
}

export default function VitalSignsMonitor({ latestVitals }: VitalSignsMonitorProps) {
  const [vitalsHistory, setVitalsHistory] = useState<{
    hr: number[];
    systolic: number[];
    diastolic: number[];
    rr: number[];
    spo2: number[];
    temp: number[];
  }>({
    hr: [],
    systolic: [],
    diastolic: [],
    rr: [],
    spo2: [],
    temp: [],
  });

  useEffect(() => {
    if (latestVitals) {
      setVitalsHistory(prev => ({
        hr: [...prev.hr, latestVitals.hr || 0].slice(-20),
        systolic: [...prev.systolic, latestVitals.bp?.systolic || 0].slice(-20),
        diastolic: [...prev.diastolic, latestVitals.bp?.diastolic || 0].slice(-20),
        rr: [...prev.rr, latestVitals.rr || 0].slice(-20),
        spo2: [...prev.spo2, latestVitals.spo2 || 0].slice(-20),
        temp: [...prev.temp, latestVitals.temp || 0].slice(-20),
      }));
    }
  }, [latestVitals]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
      },
    },
    animation: false,
  };

  const data: ChartData<'line'> = {
    labels: Array.from({ length: vitalsHistory.hr.length }, (_, i) => i + 1),
    datasets: [
      {
        label: 'Heart Rate (bpm)',
        data: vitalsHistory.hr,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'BP Systolic (mmHg)',
        data: vitalsHistory.systolic,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'BP Diastolic (mmHg)',
        data: vitalsHistory.diastolic,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        yAxisID: 'y',
      },
    ],
  };

  const secondaryData: ChartData<'line'> = {
    labels: Array.from({ length: vitalsHistory.rr.length }, (_, i) => i + 1),
    datasets: [
      {
        label: 'Respiratory Rate',
        data: vitalsHistory.rr,
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'SpO2 (%)',
        data: vitalsHistory.spo2,
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'Temperature (°C)',
        data: vitalsHistory.temp,
        borderColor: 'rgb(255, 205, 86)',
        backgroundColor: 'rgba(255, 205, 86, 0.5)',
        yAxisID: 'y',
      },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Vital Signs Monitor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-[200px]">
            <Line options={options} data={data} />
          </div>
          <div className="h-[200px]">
            <Line options={options} data={secondaryData} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm">
          <div className="flex justify-between p-2 bg-muted rounded">
            <span>HR:</span>
            <span className="font-medium">{latestVitals.hr || '-'} bpm</span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span>BP:</span>
            <span className="font-medium">
              {latestVitals.bp ? `${latestVitals.bp.systolic}/${latestVitals.bp.diastolic}` : '-'} mmHg
            </span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span>RR:</span>
            <span className="font-medium">{latestVitals.rr || '-'} /min</span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span>SpO₂:</span>
            <span className="font-medium">{latestVitals.spo2 || '-'}%</span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span>Temp:</span>
            <span className="font-medium">{latestVitals.temp || '-'}°C</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}