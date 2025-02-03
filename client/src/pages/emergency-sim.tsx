import { useSimulator } from "@/hooks/use-simulator";
import ChatInterface from "@/components/chat-interface";
import ResourceViewer from "@/components/resource-viewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import MedicalTranslator from "@/components/medical-translator";
import ATLSGuidelines from "@/components/atls-guidelines";

export default function EmergencySim() {
  const { scenarios, progress } = useSimulator();

  const emergencyScenarios = scenarios?.filter(s => s.type === "emergency") || [];

  if (!scenarios) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Loading scenarios...</AlertDescription>
      </Alert>
    );
  }

  // Use first emergency scenario by default
  const activeScenario = emergencyScenarios[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Emergency Medicine Simulator</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Simulation Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Simulation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="prose max-w-none dark:prose-invert">
                <p>{activeScenario.description}</p>
              </div>
              <ChatInterface scenarioId={activeScenario.id} />
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Medical Term Translation</CardTitle>
            </CardHeader>
            <CardContent>
              <MedicalTranslator />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Educational Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <ResourceViewer category="emergency" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {progress?.map(p => {
                  const scenario = scenarios.find(s => s.id === p.scenarioId);
                  if (!scenario || scenario.type !== "emergency") return null;
                  return (
                    <div key={p.id} className="flex justify-between items-center">
                      <span>{scenario.title}</span>
                      <span className="text-sm text-muted-foreground">
                        Score: {p.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ATLS Guidelines Section - Full Width Below */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>ATLS Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <ATLSGuidelines />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}