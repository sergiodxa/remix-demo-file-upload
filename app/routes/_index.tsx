import {
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
  json,
  unstable_createFileUploadHandler,
  unstable_composeUploadHandlers,
} from "@remix-run/node";
import type { NodeOnDiskFile, ActionFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

export async function action({ request }: ActionFunctionArgs) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  let formData = await unstable_parseMultipartFormData(
    request,
    unstable_composeUploadHandlers(
      unstable_createFileUploadHandler({
        filter({ contentType }) {
          return contentType.includes("image");
        },
        directory: "./public/img",
        avoidFileConflicts: false,
        file({ filename }) {
          return filename;
        },
        // 10MB
        maxPartSize: 10 * 1024 * 1024,
      }),
      unstable_createMemoryUploadHandler(),
    ),
  );

  let files = formData.getAll("file") as NodeOnDiskFile[];

  return json({
    files: files.map((file) => {
      return { name: file.name, url: `./img/${file.name}` };
    }),
  });
}

export default function Index() {
  let fetcher = useFetcher<typeof action>();

  let isUploading = fetcher.state !== "idle";

  let files = fetcher.formData?.getAll("file");

  let uploadingFiles = files
    ?.filter((value: unknown): value is File => value instanceof File)
    .map((file) => {
      let name = file.name;
      let url = URL.createObjectURL(file);
      return { name, url };
    });

  function uploadFiles(files: File[] | FileList) {
    let formData = new FormData();
    for (let file of files) formData.append("file", file);
    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    });
  }

  let images = (fetcher.data?.files ?? []).concat(uploadingFiles ?? []);

  return (
    <main>
      <h1>Upload a file</h1>

      <label>
        {isUploading ? <p>Uploading image...</p> : <p>Select an image</p>}

        <input
          name="file"
          type="file"
          style={{ display: "none" }}
          onChange={(event) => {
            if (!event.target.files) return;
            uploadFiles(event.target.files);
          }}
        />
      </label>

      <ul>
        {images.map((file) => {
          return <Image key={file.name} name={file.name} url={file.url} />;
        })}
      </ul>
    </main>
  );
}

function Image({ name, url }: { name: string; url: string }) {
  let [objectUrl] = useState(() => {
    if (url.startsWith("blob:")) return url;
    return undefined;
  });

  useEffect(() => {
    if (objectUrl && !url.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
  }, [objectUrl, url]);

  return (
    <img
      alt={name}
      src={url}
      width={320}
      height={240}
      style={{
        transition: "filter 300ms ease",
        filter: url.startsWith("blob:") ? "blur(4px)" : "blur(0)",
      }}
    />
  );
}
