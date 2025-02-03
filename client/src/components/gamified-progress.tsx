import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, Star, Award } from "lucide-react";
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ProgressData {
  id: number;
  scenarioId: number;
  score: number;
  completedAt: string | Date | null;
  feedback?: string | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: JSX.Element;
  achieved: boolean;
}

interface GamifiedProgressProps {
  progress: ProgressData[];
  type: "clinical" | "emergency";
}

export default function GamifiedProgress({ progress, type }: GamifiedProgressProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [averageScore, setAverageScore] = useState(0);
  const [highestScore, setHighestScore] = useState(0);
  const [progressStreak, setProgressStreak] = useState(0);

  useEffect(() => {
    if (progress.length > 0) {
      // Calculate stats
      const scores = progress.map(p => p.score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const max = Math.max(...scores);

      setAverageScore(avg);
      setHighestScore(max);

      // Calculate improvement streak
      let streak = 0;
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > scores[i - 1]) streak++;
        else break;
      }
      setProgressStreak(streak);

      // Set achievements
      setAchievements([
        {
          id: "first-chat",
          title: "First Steps",
          description: "Completed your first chat simulation",
          icon: <Star className="h-6 w-6 text-yellow-500" />,
          achieved: progress.length >= 1
        },
        {
          id: "high-score",
          title: "Excellence",
          description: "Achieved a score of 90 or higher",
          icon: <Trophy className="h-6 w-6 text-yellow-500" />,
          achieved: max >= 90
        },
        {
          id: "improvement",
          title: "Constant Improvement",
          description: "Improved scores 3 times in a row",
          icon: <TrendingUp className="h-6 w-6 text-green-500" />,
          achieved: streak >= 3
        },
        {
          id: "master",
          title: "Medical Master",
          description: "Completed 10 or more simulations",
          icon: <Award className="h-6 w-6 text-blue-500" />,
          achieved: progress.length >= 10
        }
      ]);
    }
  }, [progress]);

  // Prepare chart data - handle both string and Date objects for completedAt
  const chartData = progress.map(p => ({
    date: p.completedAt ? new Date(p.completedAt).toLocaleDateString() : 'Unknown Date',
    score: p.score
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageScore.toFixed(1)}</div>
            <Progress value={averageScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highestScore}</div>
            <Progress value={highestScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Improvement Streak</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progressStreak}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Consecutive improvements
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Score Progress</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {achievements.map(achievement => (
              <Card 
                key={achievement.id}
                className={`p-4 ${achievement.achieved ? 'bg-primary/5' : 'opacity-50'}`}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  {achievement.icon}
                  <h4 className="font-semibold">{achievement.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {achievement.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}