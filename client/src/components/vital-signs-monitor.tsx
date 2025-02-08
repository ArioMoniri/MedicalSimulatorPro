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
import { motion, AnimatePresence } from 'framer-motion';
import { useMobile } from "@/hooks/use-mobile";

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
  hr?: number;
  bp?: { systolic: number; diastolic: number };
  rr?: number;
  spo2?: number;
  temp?: number;
}

interface VitalSignsMonitorProps {
  latestVitals: VitalSigns;
}

const getVitalStatus = (type: string, value?: number): 'normal' | 'warning' | 'critical' => {
  if (!value) return 'normal';

  switch (type) {
    case 'hr':
      return value < 60 || value > 100 ? value < 50 || value > 120 ? 'critical' : 'warning' : 'normal';
    case 'systolic':
      return value < 90 || value > 140 ? value < 80 || value > 160 ? 'critical' : 'warning' : 'normal';
    case 'diastolic':
      return value < 60 || value > 90 ? value < 50 || value > 100 ? 'critical' : 'warning' : 'normal';
    case 'rr':
      return value < 12 || value > 20 ? value < 8 || value > 24 ? 'critical' : 'warning' : 'normal';
    case 'spo2':
      return value < 95 ? value < 90 ? 'critical' : 'warning' : 'normal';
    case 'temp':
      return value < 36 || value > 37.5 ? value < 35 || value > 38.5 ? 'critical' : 'warning' : 'normal';
    default:
      return 'normal';
  }
};

const HeartBeatPulse = ({ heartRate, status }: { heartRate?: number, status: string }) => {
  const duration = heartRate ? 60 / heartRate : 1;
  const color = status === 'critical' ? 'bg-red-600' : status === 'warning' ? 'bg-yellow-500' : 'bg-emerald-500';

  return (
    <div className="relative h-8 w-8 md:h-10 md:w-10 flex items-center justify-center">
      <motion.div
        className={`absolute inset-0 rounded-full ${color}`}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.6, 0.8, 0.6],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <span className="relative text-[10px] md:text-xs font-bold text-white">HR</span>
    </div>
  );
};

const SpO2Indicator = ({ value, status }: { value?: number, status: string }) => {
  const color = status === 'critical' ? 'bg-red-600' : status === 'warning' ? 'bg-yellow-500' : 'bg-emerald-500';

  return (
    <motion.div
      className={`h-8 w-8 md:h-10 md:w-10 rounded-full ${color} flex items-center justify-center`}
      animate={{
        scale: [1, 1.1, 1],
        opacity: [0.8, 1, 0.8],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <span className="text-[10px] md:text-xs font-bold text-white">O₂</span>
    </motion.div>
  );
};

const VitalSignBox = ({
  label,
  value,
  unit,
  status
}: {
  label: string;
  value: string;
  unit: string;
  status: 'normal' | 'warning' | 'critical'
}) => {
  const bgColor = status === 'critical' ? 'bg-red-950/50' : status === 'warning' ? 'bg-yellow-950/50' : 'bg-emerald-950/50';
  const borderColor = status === 'critical' ? 'border-red-600' : status === 'warning' ? 'border-yellow-500' : 'border-emerald-500';

  return (
    <div className={`p-2 md:p-4 rounded-lg border ${borderColor} ${bgColor}`}>
      <div className="space-y-1">
        <span className="text-xs md:text-sm font-medium text-gray-400">{label}</span>
        <AnimatePresence mode="wait">
          <motion.div
            key={value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="font-mono text-xl md:text-2xl tracking-wider font-bold"
          >
            {value}
            <span className="text-xs md:text-sm font-normal text-gray-400 ml-1">{unit}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function VitalSignsMonitor({ latestVitals }: VitalSignsMonitorProps) {
  const [vitalsHistory, setVitalsHistory] = useState<{
    hr: number[];
    systolic: number[];
    diastolic: number[];
    rr: number[];
    spo2: number[];
    temp: number[];
    labels: string[];
  }>({
    hr: [],
    systolic: [],
    diastolic: [],
    rr: [],
    spo2: [],
    temp: [],
    labels: [],
  });

  const isMobile = useMobile();
  const maxDataPoints = isMobile ? 6 : 10;

  const hrStatus = getVitalStatus('hr', latestVitals.hr);
  const systolicStatus = getVitalStatus('systolic', latestVitals.bp?.systolic);
  const diastolicStatus = getVitalStatus('diastolic', latestVitals.bp?.diastolic);
  const rrStatus = getVitalStatus('rr', latestVitals.rr);
  const spo2Status = getVitalStatus('spo2', latestVitals.spo2);
  const tempStatus = getVitalStatus('temp', latestVitals.temp);

  useEffect(() => {
    if (latestVitals && Object.keys(latestVitals).length > 0) {
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setVitalsHistory(prev => {
        const newHistory = {
          hr: [...prev.hr, latestVitals.hr ?? prev.hr[prev.hr.length - 1] ?? 0].slice(-maxDataPoints),
          systolic: [...prev.systolic, latestVitals.bp?.systolic ?? prev.systolic[prev.systolic.length - 1] ?? 0].slice(-maxDataPoints),
          diastolic: [...prev.diastolic, latestVitals.bp?.diastolic ?? prev.diastolic[prev.diastolic.length - 1] ?? 0].slice(-maxDataPoints),
          rr: [...prev.rr, latestVitals.rr ?? prev.rr[prev.rr.length - 1] ?? 0].slice(-maxDataPoints),
          spo2: [...prev.spo2, latestVitals.spo2 ?? prev.spo2[prev.spo2.length - 1] ?? 0].slice(-maxDataPoints),
          temp: [...prev.temp, latestVitals.temp ?? prev.temp[prev.temp.length - 1] ?? 0].slice(-maxDataPoints),
          labels: [...prev.labels, currentTime].slice(-maxDataPoints),
        };

        const hasChanges = Object.entries(newHistory).some(([key, value]) => {
          if (key === 'labels') return false;
          return value[value.length - 1] !== (prev as any)[key][prev[key as keyof typeof prev].length - 1];
        });

        return hasChanges ? newHistory : prev;
      });
    }
  }, [latestVitals, maxDataPoints]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
    },
    scales: {
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.8)',
          padding: isMobile ? 4 : 5,
          font: {
            size: isMobile ? 10 : 11,
          },
        },
        border: {
          display: false,
        },
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false,
          display: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.8)',
          maxRotation: 0,
          minRotation: 0,
          padding: isMobile ? 4 : 5,
          font: {
            size: isMobile ? 10 : 10,
          },
          autoSkip: true,
          maxTicksLimit: isMobile ? 3 : 6,
        },
        border: {
          display: false,
        },
      }
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: isMobile ? 15 : 20,
          font: {
            size: isMobile ? 11 : 11,
          },
          boxWidth: isMobile ? 8 : 8,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: isMobile ? 8 : 8,
        titleFont: {
          size: isMobile ? 12 : 12,
        },
        bodyFont: {
          size: isMobile ? 11 : 11,
        },
        displayColors: false,
      },
    },
  };

  const primaryData: ChartData<'line'> = {
    labels: vitalsHistory.labels,
    datasets: [
      {
        label: 'Heart Rate',
        data: vitalsHistory.hr,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.2,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: isMobile ? 2 : 3,
      },
      {
        label: 'BP Systolic',
        data: vitalsHistory.systolic,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.2,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: isMobile ? 2 : 3,
      },
      {
        label: 'BP Diastolic',
        data: vitalsHistory.diastolic,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.2,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: isMobile ? 2 : 3,
      },
    ],
  };

  const secondaryData: ChartData<'line'> = {
    labels: vitalsHistory.labels,
    datasets: [
      {
        label: 'Resp Rate',
        data: vitalsHistory.rr,
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        tension: 0.2,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: isMobile ? 2 : 3,
      },
      {
        label: 'SpO₂',
        data: vitalsHistory.spo2,
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        tension: 0.2,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: isMobile ? 2 : 3,
      },
      {
        label: 'Temp',
        data: vitalsHistory.temp,
        borderColor: 'rgb(255, 205, 86)',
        backgroundColor: 'rgba(255, 205, 86, 0.5)',
        tension: 0.2,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: isMobile ? 2 : 3,
      },
    ],
  };

  return (
    <Card className="bg-gray-900 text-white shadow-xl">
      <CardHeader className="border-b border-gray-800 p-4">
        <CardTitle className="text-base md:text-xl font-bold flex items-center gap-2">
          <span className="text-emerald-500">●</span>
          Patient Vital Signs Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 md:p-6 space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
          <VitalSignBox
            label="Heart Rate"
            value={latestVitals.hr?.toString() || '--'}
            unit="bpm"
            status={hrStatus}
          />
          <VitalSignBox
            label="Blood Pressure"
            value={latestVitals.bp ? `${latestVitals.bp.systolic}/${latestVitals.bp.diastolic}` : '--/--'}
            unit="mmHg"
            status={systolicStatus}
          />
          <VitalSignBox
            label="Respiratory Rate"
            value={latestVitals.rr?.toString() || '--'}
            unit="breaths/min"
            status={rrStatus}
          />
          <VitalSignBox
            label="SpO₂"
            value={latestVitals.spo2?.toString() || '--'}
            unit="%"
            status={spo2Status}
          />
          <VitalSignBox
            label="Temperature"
            value={latestVitals.temp?.toFixed(1) || '--'}
            unit="°C"
            status={tempStatus}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="text-xs md:text-sm font-medium text-gray-400">Cardiovascular Trends</h3>
            <div className="relative h-[300px] md:h-[300px] bg-black/50 rounded-lg border border-gray-800 p-4">
              <Line options={chartOptions} data={primaryData} />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs md:text-sm font-medium text-gray-400">Respiratory & Temperature Trends</h3>
            <div className="relative h-[300px] md:h-[300px] bg-black/50 rounded-lg border border-gray-800 p-4">
              <Line options={chartOptions} data={secondaryData} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}