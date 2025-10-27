import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import { FavoriteSite, InsertFavoriteSite } from '@/lib/types';

/**
 * お気に入り管理API
 * GET /api/favorites - お気に入り一覧取得
 * POST /api/favorites - お気に入り追加
 * DELETE /api/favorites - お気に入り削除
 */

/**
 * お気に入り一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 認証チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    // 2. お気に入り一覧取得
    const { data, error } = await supabase
      .from('favorite_sites')
      .select('*')
      .eq('user_id', user.id)
      .order('capture_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Favorites fetch error:', error);
      return NextResponse.json(
        { error: 'お気に入りの取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      favorites: data as FavoriteSite[],
    });
  } catch (error) {
    console.error('Favorites GET error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * お気に入り追加
 */
export async function POST(request: NextRequest) {
  try {
    // 1. リクエストボディ取得
    const body = await request.json();
    const { url, title, settings } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URLは必須です' },
        { status: 400 }
      );
    }

    // URLバリデーション
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: '有効なURLを入力してください' },
        { status: 400 }
      );
    }

    // 2. 認証チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    // 3. お気に入り追加（重複チェック付き）
    const favoriteData: InsertFavoriteSite = {
      user_id: user.id,
      url,
      title: title || null,
      last_captured: null,
      capture_count: 0,
      settings: settings || {},
    };

    const { data, error } = await supabaseAdmin
      .from('favorite_sites')
      .upsert(favoriteData, {
        onConflict: 'user_id,url',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Favorite creation error:', error);
      return NextResponse.json(
        { error: 'お気に入りの追加に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { favorite: data as FavoriteSite },
      { status: 201 }
    );
  } catch (error) {
    console.error('Favorites POST error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * お気に入り削除
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. クエリパラメータからIDを取得
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'IDは必須です' },
        { status: 400 }
      );
    }

    // 2. 認証チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    // 3. お気に入り削除（自分のお気に入りのみ削除可能）
    const { error } = await supabase
      .from('favorite_sites')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Favorite deletion error:', error);
      return NextResponse.json(
        { error: 'お気に入りの削除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Favorites DELETE error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}