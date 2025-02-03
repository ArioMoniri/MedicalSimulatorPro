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

  useEffect(() => {
    console.log("VitalSignsMonitor received new vitals:", latestVitals);

    if (latestVitals && Object.keys(latestVitals).length > 0) {
      const currentTime = new Date().toLocaleTimeString();

      setVitalsHistory(prev => {
        console.log("Current vitals history:", prev);

        const newHistory = {
          hr: [...prev.hr, latestVitals.hr ?? prev.hr[prev.hr.length - 1] ?? 0].slice(-20),
          systolic: [...prev.systolic, latestVitals.bp?.systolic ?? prev.systolic[prev.systolic.length - 1] ?? 0].slice(-20),
          diastolic: [...prev.diastolic, latestVitals.bp?.diastolic ?? prev.diastolic[prev.diastolic.length - 1] ?? 0].slice(-20),
          rr: [...prev.rr, latestVitals.rr ?? prev.rr[prev.rr.length - 1] ?? 0].slice(-20),
          spo2: [...prev.spo2, latestVitals.spo2 ?? prev.spo2[prev.spo2.length - 1] ?? 0].slice(-20),
          temp: [...prev.temp, latestVitals.temp ?? prev.temp[prev.temp.length - 1] ?? 0].slice(-20),
          labels: [...prev.labels, currentTime].slice(-20),
        };

        console.log("New vitals history:", newHistory);

        // Check if there are actual changes
        const hasChanges = Object.entries(newHistory).some(([key, value]) => {
          if (key === 'labels') return false;
          const lastNew = value[value.length - 1];
          const lastPrev = (prev as any)[key][prev[key as keyof typeof prev].length - 1];
          console.log(`Comparing ${key}:`, lastNew, lastPrev);
          return lastNew !== lastPrev;
        });

        console.log("Has changes:", hasChanges);
        return hasChanges ? newHistory : prev;
      });
    } else {
      console.log("Received empty or invalid vitals");
    }
  }, [latestVitals]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
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
          maxRotation: 45,
          minRotation: 45,
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
  };

  const primaryData: ChartData<'line'> = {
    labels: vitalsHistory.labels,
    datasets: [
      {
        label: 'Heart Rate (bpm)',
        data: vitalsHistory.hr,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.2,
      },
      {
        label: 'BP Systolic (mmHg)',
        data: vitalsHistory.systolic,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.2,
      },
      {
        label: 'BP Diastolic (mmHg)',
        data: vitalsHistory.diastolic,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.2,
      },
    ],
  };

  const secondaryData: ChartData<'line'> = {
    labels: vitalsHistory.labels,
    datasets: [
      {
        label: 'Respiratory Rate (breaths/min)',
        data: vitalsHistory.rr,
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        tension: 0.2,
      },
      {
        label: 'SpO2 (%)',
        data: vitalsHistory.spo2,
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        tension: 0.2,
      },
      {
        label: 'Temperature (°C)',
        data: vitalsHistory.temp,
        borderColor: 'rgb(255, 205, 86)',
        backgroundColor: 'rgba(255, 205, 86, 0.5)',
        tension: 0.2,
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
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={latestVitals.hr || 'no-hr'}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="font-mono text-2xl tracking-wider"
                    >
                      {latestVitals.hr || '--'}
                    </motion.span>
                  </AnimatePresence>
                  <span className="block text-xs text-gray-400">BPM</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <BreathingWave respiratoryRate={latestVitals.rr} />
                <div className="space-y-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={latestVitals.rr || 'no-rr'}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="font-mono text-2xl tracking-wider"
                    >
                      {latestVitals.rr || '--'}
                    </motion.span>
                  </AnimatePresence>
                  <span className="block text-xs text-gray-400">RR/min</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <SpO2Pulse value={latestVitals.spo2} />
                <div className="space-y-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={latestVitals.spo2 || 'no-spo2'}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="font-mono text-2xl tracking-wider"
                    >
                      {latestVitals.spo2 || '--'}
                    </motion.span>
                  </AnimatePresence>
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
                  <AnimatePresence mode="wait">
                    <motion.span 
                      key={`${latestVitals.bp?.systolic || 'no-bp'}-${latestVitals.bp?.diastolic || 'no-bp'}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="font-mono text-2xl tracking-wider"
                    >
                      {latestVitals.bp ? `${latestVitals.bp.systolic}/${latestVitals.bp.diastolic}` : '--/--'}
                    </motion.span>
                  </AnimatePresence>
                  <span className="block text-xs text-gray-400">mmHg</span>
                </div>
              </div>
            </div>

            {/* Primary Vitals Chart */}
            <div className="h-[250px] bg-black rounded-lg border border-gray-800 p-4">
              <Line options={options} data={primaryData} />
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
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={latestVitals.temp || 'no-temp'}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="font-mono text-2xl tracking-wider"
                    >
                      {latestVitals.temp?.toFixed(1) || '--'}°C
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="p-4 bg-black rounded-lg border border-gray-800">
                <div className="space-y-2">
                  <span className="text-sm text-gray-400">SpO₂ Trend</span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={latestVitals.spo2 || 'no-spo2'}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="font-mono text-2xl tracking-wider"
                    >
                      {latestVitals.spo2 || '--'}%
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}