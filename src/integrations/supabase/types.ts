export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          created_at: string
          email: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          agency_id: string
          created_at: string
          description: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          agency_id: string
          name: string
          description: string
          icon: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          name: string
          description?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agency_id?: string
          name?: string
          description?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          agency_id: string
          campaign_id: string | null
          category_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          name: string
          platform_id: string
          qr_type: string
          status: string
          unique_code: string
          updated_at: string
          card_headline: string
          card_subtitle: string
          card_business_name: string | null
          card_footer_text: string
        }
        Insert: {
          agency_id: string
          campaign_id?: string | null
          category_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          name: string
          platform_id: string
          qr_type?: string
          status?: string
          unique_code: string
          updated_at?: string
          card_headline?: string
          card_subtitle?: string
          card_business_name?: string | null
          card_footer_text?: string
        }
        Update: {
          agency_id?: string
          campaign_id?: string | null
          category_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          name?: string
          platform_id?: string
          qr_type?: string
          status?: string
          unique_code?: string
          updated_at?: string
          card_headline?: string
          card_subtitle?: string
          card_business_name?: string | null
          card_footer_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "review_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      review_templates: {
        Row: {
          id: string
          agency_id: string
          category_id: string
          title: string
          content: string
          rating: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          category_id: string
          title: string
          content: string
          rating?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agency_id?: string
          category_id?: string
          title?: string
          content?: string
          rating?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      submitted_reviews: {
        Row: {
          id: string
          agency_id: string
          qr_code_id: string | null
          category_id: string | null
          template_id: string | null
          reviewer_name: string
          reviewer_email: string | null
          rating: number
          review_text: string
          is_custom: boolean
          status: string
          device_category: string
          created_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          qr_code_id?: string | null
          category_id?: string | null
          template_id?: string | null
          reviewer_name?: string
          reviewer_email?: string | null
          rating: number
          review_text: string
          is_custom?: boolean
          status?: string
          device_category?: string
          created_at?: string
        }
        Update: {
          id?: string
          agency_id?: string
          qr_code_id?: string | null
          category_id?: string | null
          template_id?: string | null
          reviewer_name?: string
          reviewer_email?: string | null
          rating?: number
          review_text?: string
          is_custom?: boolean
          status?: string
          device_category?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submitted_reviews_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submitted_reviews_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submitted_reviews_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submitted_reviews_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "review_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      review_card_templates: {
        Row: {
          agency_id: string
          body_text: string
          created_at: string
          headline: string
          id: string
          name: string
          orientation: string
          platform_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          body_text?: string
          created_at?: string
          headline?: string
          id?: string
          name?: string
          orientation?: string
          platform_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          body_text?: string
          created_at?: string
          headline?: string
          id?: string
          name?: string
          orientation?: string
          platform_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_card_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_card_templates_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "review_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      review_platforms: {
        Row: {
          agency_id: string
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          platform_type: string
          profile_url: string | null
          review_url: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          platform_type: string
          profile_url?: string | null
          review_url?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          platform_type?: string
          profile_url?: string | null
          review_url?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_platforms_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_events: {
        Row: {
          created_at: string
          device_category: string
          id: string
          qr_code_id: string
          referrer_host: string | null
        }
        Insert: {
          created_at?: string
          device_category?: string
          id?: string
          qr_code_id: string
          referrer_host?: string | null
        }
        Update: {
          created_at?: string
          device_category?: string
          id?: string
          qr_code_id?: string
          referrer_host?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_events_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_review_scan: {
        Args: {
          _code: string
          _device_category?: string
          _referrer_host?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
