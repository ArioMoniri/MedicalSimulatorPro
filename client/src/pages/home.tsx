import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Stethoscope, Siren, Mic, Image, AlertCircle, Trophy } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <section className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Acibadem Medical Simulation Platform
        </h1>
        <p className="text-xl text-muted-foreground">
          Practice emergency medicine and clinical scenarios in an interactive environment
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Siren className="h-6 w-6 text-red-500" />
              Emergency Medicine Simulator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Practice handling emergency scenarios and time-critical decisions in a safe environment
            </p>
            <Button asChild className="w-full">
              <Link href="/emergency">Start Emergency Simulation</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-6 w-6 text-blue-500" />
              Clinical Practice Simulator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Practice patient consultations and clinical decision-making with realistic scenarios
            </p>
            <Button asChild className="w-full">
              <Link href="/clinical">Start Clinical Simulation</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <Card className="bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Voice & Image Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use natural voice commands and upload medical images during simulations
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Real-time Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Receive immediate feedback and guidance on your clinical decisions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Track Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Monitor your performance and improvement over time
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}