CREATE TABLE "registration_field_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"profile_key" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_fields" ADD COLUMN "catalog_field_id" uuid;--> statement-breakpoint
ALTER TABLE "registration_field_catalog" ADD CONSTRAINT "registration_field_catalog_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_fields" ADD CONSTRAINT "registration_fields_catalog_field_id_registration_field_catalog_id_fk" FOREIGN KEY ("catalog_field_id") REFERENCES "public"."registration_field_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "registration_field_catalog" ("key", "label", "type", "options", "profile_key")
SELECT DISTINCT "key", "label", "type", "options", "profile_key"
FROM "registration_fields";--> statement-breakpoint
UPDATE "registration_fields" AS field
SET "catalog_field_id" = catalog."id"
FROM "registration_field_catalog" AS catalog
WHERE field."catalog_field_id" IS NULL
  AND field."key" = catalog."key"
  AND field."label" = catalog."label"
  AND field."type" = catalog."type"
  AND field."options" = catalog."options"
  AND field."profile_key" IS NOT DISTINCT FROM catalog."profile_key";--> statement-breakpoint
INSERT INTO "registration_field_catalog" ("key", "label", "type", "options", "profile_key")
SELECT seed."key", seed."label", seed."type", seed."options"::jsonb, seed."profile_key"
FROM (
  VALUES
    ('firstName', 'שם פרטי', 'text', '[]', 'firstName'),
    ('lastName', 'שם משפחה', 'text', '[]', 'lastName'),
    ('email', 'דואר אלקטרוני', 'email', '[]', NULL),
    ('phone', 'טלפון', 'tel', '[]', 'phone'),
    ('idNumber', 'תעודת זהות', 'text', '[]', 'idNumber')
) AS seed("key", "label", "type", "options", "profile_key")
WHERE NOT EXISTS (
  SELECT 1
  FROM "registration_field_catalog" AS catalog
  WHERE catalog."key" = seed."key"
);
