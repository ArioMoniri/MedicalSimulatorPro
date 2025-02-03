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
          <div className="space-y-4">
            {/* Animated Vitals Display */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-black rounded-lg">
              <div className="flex items-center space-x-2 text-white">
                <HeartBeatPulse heartRate={latestVitals.hr} />
                <span className="font-mono text-xl">{latestVitals.hr || '-'}</span>
                <span className="text-sm text-gray-400">bpm</span>
              </div>
              <div className="flex items-center space-x-2 text-white">
                <BreathingWave respiratoryRate={latestVitals.rr} />
                <span className="font-mono text-xl">{latestVitals.rr || '-'}</span>
                <span className="text-sm text-gray-400">/min</span>
              </div>
              <div className="flex items-center space-x-2 text-white">
                <SpO2Pulse value={latestVitals.spo2} />
                <span className="font-mono text-xl">{latestVitals.spo2 || '-'}</span>
                <span className="text-sm text-gray-400">%</span>
              </div>
              <div className="flex items-center space-x-2 text-white">
                <motion.span 
                  className="font-mono text-xl"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {latestVitals.bp ? `${latestVitals.bp.systolic}/${latestVitals.bp.diastolic}` : '-'}
                </motion.span>
                <span className="text-sm text-gray-400">mmHg</span>
              </div>
            </div>

            {/* Charts */}
            <div className="h-[200px]">
              <Line options={options} data={data} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-[200px]">
              <Line options={options} data={secondaryData} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>Temp:</span>
                <motion.span 
                  className="font-medium"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {latestVitals.temp || '-'}°C
                </motion.span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>SpO₂:</span>
                <span className="font-medium">{latestVitals.spo2 || '-'}%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}