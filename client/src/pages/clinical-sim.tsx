import { useSimulator } from "@/hooks/use-simulator";
import ChatInterface from "@/components/chat-interface";
import ResourceViewer from "@/components/resource-viewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import MedicalTranslator from "@/components/medical-translator";

export default function ClinicalSim() {
  const { scenarios, progress } = useSimulator();

  const clinicalScenarios = scenarios?.filter(s => s.type === "clinical") || [];

  if (!scenarios) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Loading scenarios...</AlertDescription>
      </Alert>
    );
  }

  // Use first clinical scenario by default
  const activeScenario = clinicalScenarios[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Clinical Practice Simulator</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Patient Consultation</CardTitle>
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
              <CardTitle>Clinical Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <ResourceViewer category="clinical" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {progress?.map(p => {
                  const scenario = scenarios.find(s => s.id === p.scenarioId);
                  if (!scenario || scenario.type !== "clinical") return null;
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
      </div>
    </div>
  );
}