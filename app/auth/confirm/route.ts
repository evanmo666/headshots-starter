import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") || "/";

  if (token_hash && type) {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    try {
      const { error } = await supabase.auth.verifyOtp({
        type: type as any,
        token_hash,
      });

      if (error) {
        console.error("Error verifying OTP:", error);
        return NextResponse.redirect(
          `${requestUrl.origin}/login/failed?err=AuthApiError`
        );
      }

      // 验证成功后，检查用户是否需要初始化积分
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Error getting user:", userError);
        return NextResponse.redirect(
          `${requestUrl.origin}/login/failed?err=500`
        );
      }

      // 检查用户是否已有积分记录，如果没有则创建
      const { data: credits, error: creditsError } = await supabase
        .from("credits")
        .select("*")
        .eq("user_id", user.user.id)
        .single();

      if (creditsError && creditsError.code === "PGRST116") {
        // 用户没有积分记录，创建一个
        const { error: insertError } = await supabase
          .from("credits")
          .insert({
            user_id: user.user.id,
            credits: 3, // 给新用户3个初始积分
          });

        if (insertError) {
          console.error("Error creating credits:", insertError);
        }
      }

    } catch (error) {
      console.error("Error in auth confirm:", error);
      return NextResponse.redirect(
        `${requestUrl.origin}/login/failed?err=500`
      );
    }
  }

  return NextResponse.redirect(new URL(next, req.url));
} 