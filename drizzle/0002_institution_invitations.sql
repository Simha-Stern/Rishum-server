CREATE TABLE "institution_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "invited_email" text NOT NULL,
  "invited_by_user_id" uuid NOT NULL,
  "role" "institution_member_role" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institution_invitations" ADD CONSTRAINT "institution_invitations_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "institution_invitations" ADD CONSTRAINT "institution_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "institution_invitations_institution_email_unique" ON "institution_invitations" USING btree ("institution_id", "invited_email");
--> statement-breakpoint
CREATE INDEX "institution_invitations_email_idx" ON "institution_invitations" USING btree ("invited_email");
