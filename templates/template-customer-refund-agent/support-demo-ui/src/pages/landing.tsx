import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export function Landing() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Welcome to the demo</CardTitle>
          <CardDescription>
            A quick look at an AI-assisted support workflow, built with Mastra.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            This demo starts with synthetic local orders and policies. Optional
            Intercom development and Stripe sandbox adapters are configured
            separately.
          </p>
          <p>
            Inspect the recorded evidence and review a proposed refund in the
            admin dashboard.
          </p>
        </CardContent>
        <CardFooter>
          <Link to="/admin" className={buttonVariants()}>
            Open admin queue
            <ArrowRight data-icon="inline-end" />
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
