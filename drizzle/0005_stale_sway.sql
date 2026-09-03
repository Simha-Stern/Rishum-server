DROP INDEX "registration_flows_institution_unique";--> statement-breakpoint
CREATE INDEX "registration_flows_institution_idx" ON "registration_flows" USING btree ("institution_id");