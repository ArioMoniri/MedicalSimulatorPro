import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";

interface Resource {
  id: string;
  title: string;
  content: string;
  url?: string;
}

const EMERGENCY_RESOURCES: Resource[] = [
  {
    id: "e1",
    title: "ATLS Guidelines",
    content: "Guideline",
    url: "https://atlsquestionbank.com/about/"
  },
  {
    id: "e2",
    title: "Trauma Assessment",
    content: "https://atlsquestionbank.com/about/.",
  },
  {
    id: "e3",
    title: "Drug Protocols",
    content: "https://atlsquestionbank.com/about/.",
  }
];

const CLINICAL_RESOURCES: Resource[] = [
  {
    id: "c1",
    title: "Physical Examination",
    content: "https://atlsquestionbank.com/about/",
  },
  {
    id: "c2",
    title: "History Taking",
    content: "https://atlsquestionbank.com/about/",
  },
  {
    id: "c3",
    title: "Differential Diagnosis",
    content: "https://atlsquestionbank.com/about/",
  }
];

interface ResourceViewerProps {
  category: "emergency" | "clinical";
}

export default function ResourceViewer({ category }: ResourceViewerProps) {
  const resources = category === "emergency" ? EMERGENCY_RESOURCES : CLINICAL_RESOURCES;

  return (
    <ScrollArea className="h-[400px]">
      <Accordion type="single" collapsible>
        {resources.map((resource) => (
          <AccordionItem key={resource.id} value={resource.id}>
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {resource.title}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm">
                <p>{resource.content}</p>
                {resource.url && (
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => window.open(resource.url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Learn More
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollArea>
  );
}
