
/**
 * GARANTI GROUP
 * Project image upload
 *
 * Storage:
 * - GitHub (new)
 * - Supabase (legacy compatibility)
 *
 * Order attachments remain private in Firebase.
 */

export function isProjectImageUrl(value) {
  try {
    if (typeof value !== 'string') return false;

    const u = new URL(value);

    // Only clean HTTPS public URLs are accepted.
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.port ||
      u.search ||
      u.hash
    ) {
      return false;
    }

    // Previous Supabase public project images.
    const supabase =
      /^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) &&
      /^\/storage\/v1\/object\/public\/project-images\/[A-Za-z0-9/_-]+\.(?:jpg|png|webp)$/.test(
        u.pathname
      );

    // GitHub raw content.
    // Supports:
    // /main/projects/UUID.jpg
    // /COMMIT_SHA/projects/UUID.jpg
    // /COMMIT_SHA/uploads/projects/UUID.jpg
    const github =
      u.hostname === 'raw.githubusercontent.com' &&
      /^\/teslamap\/garanti-group\/(?:[a-f0-9]{40}|main)\/(?:uploads\/)?projects\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(
        u.pathname
      );

    return supabase || github;
  } catch {
    return false;
  }
}

export async function uploadProjectPhoto(
  photo,
  user,
  endpoint,
  fetcher = fetch
) {
  if (!endpoint) {
    throw Error(
      'პროექტის ფოტოების ატვირთვის Worker არ არის მითითებული.'
    );
  }

  // Accept JPEG, PNG and WebP data URLs.
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
      photo
    );

  if (!match || photo.length > 2000100) {
    throw Error(
      'ფოტო: JPG, PNG ან WebP, მაქსიმუმ 1.5 MB'
    );
  }

  const bytes = Uint8Array.from(
    atob(match[2]),
    c => c.charCodeAt(0)
  );

  if (!bytes.length || bytes.length > 1500000) {
    throw Error(
      'ფოტო: მაქსიმუმ 1.5 MB'
    );
  }

  const extension =
    match[1] === 'jpeg' ? 'jpg' : match[1];

  const form = new FormData();

  form.append(
    'file',
    new Blob([bytes], {
      type: 'image/' + match[1]
    }),
    'project.' + extension
  );

  // Refresh Firebase ID token.
  const token = await user.getIdToken(true);

  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token
    },
    body: form,
    signal: AbortSignal.timeout(30000),
    redirect: 'error'
  });

  const data = await response.json().catch(() => ({}));

  // Authentication errors.
  if (response.status === 401) {
    if (data.error === 'AUTH_REQUIRED') {
      throw Error(
        'Worker-მა ავტორიზაციის ტოკენი ვერ მიიღო (AUTH_REQUIRED).'
      );
    }

    if (data.error === 'INVALID_TOKEN') {
      throw Error(
        'Worker-მა Firebase ტოკენი უარყო (INVALID_TOKEN).'
      );
    }

    throw Error(
      'Worker-მა ატვირთვის ავტორიზაცია უარყო (HTTP 401).'
    );
  }

  // Admin permission.
  if (response.status === 403) {
    throw Error(
      'Worker-მა ატვირთვა უარყო. გადაამოწმეთ Firebase admins/{uid}.active=true.'
    );
  }

  // GitHub storage configuration.
  if (data.error === 'GITHUB_STORAGE_NOT_CONFIGURED') {
    throw Error(
      'GitHub-ზე ფოტოების ატვირთვა ჯერ არ არის ჩართული.'
    );
  }

  if (data.error === 'GITHUB_STORAGE_ACCESS_DENIED') {
    throw Error(
      'GitHub-ზე ჩაწერის წვდომა უარყოფილია.'
    );
  }

  if (data.error === 'GITHUB_STORAGE_CONFLICT') {
    throw Error(
      'GitHub-ზე პარალელური ცვლილებაა. სცადეთ ხელახლა.'
    );
  }

  // Other server errors.
  if (!response.ok) {
    throw Error(
      'პროექტის ფოტო ვერ აიტვირთა. Worker /api/upload გადასამოწმებელია.'
    );
  }

  // Validate the returned public image URL.
  if (!isProjectImageUrl(data.url)) {
    throw Error(
      'Worker-მა პროექტის ფოტოს სწორი საჯარო URL არ დააბრუნა.'
    );
  }

  return data.url;
}
