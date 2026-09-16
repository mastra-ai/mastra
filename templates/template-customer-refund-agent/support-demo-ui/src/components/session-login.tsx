import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { login, type SupportSession } from "@/lib/api";

export function SessionLogin({
  email,
  password,
  onSession,
}: {
  email: string;
  password: string;
  onSession: (session: SupportSession) => void;
}) {
  const [emailDraft, setEmailDraft] = useState(email);
  const [passwordDraft, setPasswordDraft] = useState(password);
  const [pending, setPending] = useState(false);
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Sign in to the local demo</CardTitle>
        <CardDescription>
          Your verified session controls which cases and actions are available.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            try {
              onSession(await login(emailDraft, passwordDraft));
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Sign in failed",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="session-email">Email</FieldLabel>
              <Input
                id="session-email"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="session-password">Password</FieldLabel>
              <Input
                id="session-password"
                type="password"
                value={passwordDraft}
                onChange={(event) => setPasswordDraft(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
