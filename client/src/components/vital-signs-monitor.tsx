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

const HeartBeatPulse = ({ heartRate }: { heartRate?: number }) => {
  const duration = heartRate ? 60 / heartRate : 1;

  return (
    <div className="relative h-8 w-8">
      <motion.div
        className="absolute inset-0 bg-red-500 rounded-full"
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
    </div>
  );
};

const BreathingWave = ({ respiratoryRate }: { respiratoryRate?: number }) => {
  const duration = respiratoryRate ? 60 / respiratoryRate : 3;

  return (
    <motion.div
      className="h-8 w-16 bg-blue-500"
      animate={{
        scaleY: [1, 1.5, 1],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
};

const SpO2Pulse = ({ value }: { value?: number }) => {
  return (
    <motion.div
      className="h-6 w-6 rounded-full bg-purple-500"
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
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
        hr: [...prev.hr, latestVitals.hr || prev.hr[prev.hr.length - 1] || 0].slice(-20),
        systolic: [...prev.systolic, latestVitals.bp?.systolic || prev.systolic[prev.systolic.length - 1] || 0].slice(-20),
        diastolic: [...prev.diastolic, latestVitals.bp?.diastolic || prev.diastolic[prev.diastolic.length - 1] || 0].slice(-20),
        rr: [...prev.rr, latestVitals.rr || prev.rr[prev.rr.length - 1] || 0].slice(-20),
        spo2: [...prev.spo2, latestVitals.spo2 || prev.spo2[prev.spo2.length - 1] || 0].slice(-20),
        temp: [...prev.temp, latestVitals.temp || prev.temp[prev.temp.length - 1] || 0].slice(-20),
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
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.8)',
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.8)',
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
        }
      }
    },
    animation: {
      duration: 750,
    },
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
    <Card className="bg-gray-900 text-white">
      <CardHeader className="border-b border-gray-800">
        <CardTitle className="text-xl font-bold">Patient Vital Signs Monitor</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Animated Vitals Display */}
            <div className="grid grid-cols-2 gap-4 p-6 bg-black rounded-lg border border-gray-800">
              <div className="flex items-center space-x-3">
                <HeartBeatPulse heartRate={latestVitals.hr} />
                <div className="space-y-1">
                  <span className="font-mono text-2xl tracking-wider">{latestVitals.hr || '--'}</span>
                  <span className="block text-xs text-gray-400">BPM</span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <BreathingWave respiratoryRate={latestVitals.rr} />
                <div className="space-y-1">
                  <span className="font-mono text-2xl tracking-wider">{latestVitals.rr || '--'}</span>
                  <span className="block text-xs text-gray-400">RR/min</span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <SpO2Pulse value={latestVitals.spo2} />
                <div className="space-y-1">
                  <span className="font-mono text-2xl tracking-wider">{latestVitals.spo2 || '--'}</span>
                  <span className="block text-xs text-gray-400">SpO₂ %</span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <motion.div 
                  className="h-8 w-8 flex items-center justify-center rounded-full border border-blue-500"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-xs text-blue-500">BP</span>
                </motion.div>
                <div className="space-y-1">
                  <motion.span 
                    className="font-mono text-2xl tracking-wider"
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {latestVitals.bp ? `${latestVitals.bp.systolic}/${latestVitals.bp.diastolic}` : '--/--'}
                  </motion.span>
                  <span className="block text-xs text-gray-400">mmHg</span>
                </div>
              </div>
            </div>

            {/* Primary Vitals Chart */}
            <div className="h-[250px] bg-black rounded-lg border border-gray-800 p-4">
              <Line options={options} data={data} />
            </div>
          </div>

          {/* Secondary Charts and Info */}
          <div className="space-y-6">
            <div className="h-[250px] bg-black rounded-lg border border-gray-800 p-4">
              <Line options={options} data={secondaryData} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black rounded-lg border border-gray-800">
                <div className="space-y-2">
                  <span className="text-sm text-gray-400">Temperature</span>
                  <motion.div 
                    className="font-mono text-2xl tracking-wider"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {latestVitals.temp?.toFixed(1) || '--'}°C
                  </motion.div>
                </div>
              </div>
              <div className="p-4 bg-black rounded-lg border border-gray-800">
                <div className="space-y-2">
                  <span className="text-sm text-gray-400">SpO₂ Trend</span>
                  <div className="font-mono text-2xl tracking-wider">
                    {latestVitals.spo2 || '--'}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}