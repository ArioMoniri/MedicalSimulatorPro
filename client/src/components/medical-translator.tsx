import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

const translationSchema = z.object({
  text: z.string().min(1, "Medical term is required"),
  targetLanguage: z.string().min(2, "Target language is required"),
});

type TranslationForm = z.infer<typeof translationSchema>;

const languages = [
  { code: "tr", name: "Turkish" },
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
];

export default function MedicalTranslator() {
  const [translation, setTranslation] = useState<string | null>(null);

  const form = useForm<TranslationForm>({
    resolver: zodResolver(translationSchema),
    defaultValues: {
      text: "",
      targetLanguage: "",
    },
  });

  const translateMutation = useMutation({
    mutationFn: async (data: TranslationForm) => {
      const response = await fetch("/api/medical/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();
      return result.translation;
    },
    onSuccess: (data) => {
      setTranslation(data);
    },
  });

  const onSubmit = (data: TranslationForm) => {
    translateMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Medical Terminology Translator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical Term or Phrase</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter medical terminology..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Language</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={translateMutation.isPending}
            >
              {translateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                "Translate"
              )}
            </Button>
          </form>
        </Form>

        {translateMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {translateMutation.error instanceof Error
                ? translateMutation.error.message
                : "Failed to translate"}
            </AlertDescription>
          </Alert>
        )}

        {translation && (
          <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
            <h3 className="font-semibold mb-2">Translation Result:</h3>
            <p className="whitespace-pre-wrap">{translation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}