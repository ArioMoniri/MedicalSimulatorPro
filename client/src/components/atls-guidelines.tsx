import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, BookOpen } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

const guidelineSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  context: z.string().optional(),
});

type GuidelineForm = z.infer<typeof guidelineSchema>;

export default function ATLSGuidelines() {
  const [guidelines, setGuidelines] = useState<string | null>(null);

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
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      return result.guidelines;
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
              {guidelineMutation.error.message}
            </AlertDescription>
          </Alert>
        )}

        {guidelines && (
          <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
            <h3 className="font-semibold mb-2">ATLS Guidelines:</h3>
            <div className="whitespace-pre-wrap prose prose-sm max-w-none">
              {guidelines}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
