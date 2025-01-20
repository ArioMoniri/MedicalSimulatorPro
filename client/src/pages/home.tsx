import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          Welcome to Acibadem Medical Simulation Platform
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Practice emergency medicine and clinical scenarios in an interactive environment
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Emergency Medicine Simulator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Practice handling emergency scenarios and time-critical decisions</p>
            <img
              src="https://images.unsplash.com/photo-1576671081741-c538eafccfff"
              alt="Emergency Room"
              className="rounded-lg object-cover aspect-video"
            />
            <Button asChild className="w-full">
              <Link href="/emergency">Start Emergency Simulation</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinical Practice Simulator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Practice patient consultations and clinical decision-making</p>
            <img
              src="https://images.unsplash.com/photo-1471864190281-a93a3070b6de"
              alt="Medical Consultation"
              className="rounded-lg object-cover aspect-video"
            />
            <Button asChild className="w-full">
              <Link href="/clinical">Start Clinical Simulation</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI-Powered Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Interact with realistic AI-driven patient scenarios</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Voice & Image Input</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Use voice commands and upload medical images during simulations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instant Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Receive immediate feedback on your clinical decisions</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
