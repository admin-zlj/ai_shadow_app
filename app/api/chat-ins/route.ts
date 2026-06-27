import { NextResponse, type NextRequest } from "next/server";

export const POST = (request: NextRequest) => {
  return NextResponse.json(
    { message: "Hello, World!" },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  );
};
