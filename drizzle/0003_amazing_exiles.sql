ALTER TABLE "registrations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_flows" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
