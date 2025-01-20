import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BookOpen } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

const guidelineSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  context: z.string().optional(),
});

type GuidelineForm = z.infer<typeof guidelineSchema>;

interface GuidelineResponse {
  text: string;
  flowchart: {
    nodes: any[];
    edges: any[];
  };
}

const nodeTypes = {
  decision: ({ data }: { data: { label: string } }) => (
    <div className="p-2 rounded-lg border-2 border-primary bg-background">
      {data.label}
    </div>
  ),
  action: ({ data }: { data: { label: string } }) => (
    <div className="p-2 rounded-lg border border-muted-foreground bg-muted">
      {data.label}
    </div>
  ),
};

export default function ATLSGuidelines() {
  const [guidelines, setGuidelines] = useState<GuidelineResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"text" | "mindmap">("text");

  const form = useForm<GuidelineForm>({
    resolver: zodResolver(guidelineSchema),
    defaultValues: {
      topic: "",
      context: "",
    },
  });

  const guidelineMutation = useMutation({
    mutationFn: async (data: GuidelineForm) => {
      const response = await fetch("/api/medical/guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setGuidelines(data);
    },
  });

  const onSubmit = (data: GuidelineForm) => {
    guidelineMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          ATLS Guidelines Reference
        </CardTitle>
        <CardDescription>
          Access evidence-based Advanced Trauma Life Support (ATLS) guidelines and protocols
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Primary Survey, Chest Trauma..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="context"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Context (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide any specific context or scenario..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={guidelineMutation.isPending}
            >
              {guidelineMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching Guidelines...
                </>
              ) : (
                "Get Guidelines"
              )}
            </Button>
          </form>
        </Form>

        {guidelineMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {guidelineMutation.error instanceof Error
                ? guidelineMutation.error.message
                : "Failed to fetch guidelines"}
            </AlertDescription>
          </Alert>
        )}

        {guidelines && (
          <div className="mt-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "text" | "mindmap")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text Guidelines</TabsTrigger>
                <TabsTrigger value="mindmap">Decision Tree</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4">
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <h3 className="font-semibold mb-2">ATLS Guidelines:</h3>
                  <div className="prose prose-sm max-w-none">
                    {guidelines.text}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mindmap" className="mt-4">
                <div className="h-[500px] border rounded-lg bg-secondary/50">
                  <ReactFlow
                    nodes={guidelines.flowchart.nodes}
                    edges={guidelines.flowchart.edges}
                    nodeTypes={nodeTypes}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}