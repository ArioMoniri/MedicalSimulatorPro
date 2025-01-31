import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

const guidelineSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  context: z.string().optional(),
});

type GuidelineForm = z.infer<typeof guidelineSchema>;

interface FlowchartData {
  nodes: Node[];
  edges: Edge[];
}

interface GuidelineResponse {
  text: string;
  flowchart: FlowchartData;
}

// Custom node types for the decision tree
const nodeTypes = {
  decision: ({ data }: any) => (
    <div className="px-4 py-2 rounded-lg shadow-md border-2 border-primary bg-background min-w-[150px] text-center">
      {data.label}
    </div>
  ),
  action: ({ data }: any) => (
    <div className="px-4 py-2 rounded-lg shadow-md border border-muted-foreground bg-muted min-w-[150px] text-center">
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

      const result = await response.json();
      return result.guidelines;
    },
    onSuccess: (data) => {
      setGuidelines(data);
      // Set nodes and edges positions if not defined
      if (data.flowchart?.nodes) {
        data.flowchart.nodes = data.flowchart.nodes.map((node, index) => ({
          ...node,
          position: node.position || {
            x: index % 2 === 0 ? 0 : 300,
            y: index * 100,
          },
        }));
      }
    },
  });

  const onSubmit = (data: GuidelineForm) => {
    guidelineMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., Primary Survey, Chest Trauma..." 
                    {...field} 
                  />
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

      {guidelineMutation.isPending && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {guidelines && (
        <div className="mt-6 border rounded-lg bg-card p-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "text" | "mindmap")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Text Guidelines</TabsTrigger>
              <TabsTrigger value="mindmap">Decision Tree</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="whitespace-pre-wrap">{guidelines.text}</div>
              </div>
            </TabsContent>

            <TabsContent value="mindmap" className="mt-4">
              <div className="h-[500px] border rounded-lg bg-background/50">
                <ReactFlow
                  nodes={guidelines.flowchart?.nodes || []}
                  edges={guidelines.flowchart?.edges || []}
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
    </div>
  );
}