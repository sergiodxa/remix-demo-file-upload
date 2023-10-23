import {
  json,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
  unstable_createFileUploadHandler,
  unstable_composeUploadHandlers,
} from "@remix-run/node";
import type { NodeOnDiskFile, ActionFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

export async function action({ request }: ActionFunctionArgs) {
  let formData = await unstable_parseMultipartFormData(
    request,
    unstable_composeUploadHandlers(
      unstable_createFileUploadHandler({
        // Limit file upload to images
        filter({ contentType }) {
          return contentType.includes("image");
        },
        // Store the images in the public/img folder
        directory: "./public/img",
        // By default `unstable_createFileUploadHandler` add a number to the file
        // names if there's another with the same name, by disabling it we replace
        // the old file
        avoidFileConflicts: false,
        // Use the actual filename as the final filename
        file({ filename }) {
          return filename;
        },
        // Limit the max size to 10MB
        maxPartSize: 10 * 1024 * 1024,
      }),
      unstable_createMemoryUploadHandler(),
    ),
  );

  let files = formData.getAll("file") as NodeOnDiskFile[];
  return json({
    files: files.map((file) => ({ name: file.name, url: `/img/${file.name}` })),
  });
}

export default function Component() {
  let { submit, isUploading, images } = useFileUpload();

  return (
    <main>
      <h1>Upload a file</h1>

      <label>
        {/* Here we use our boolean to change the label text */}
        {isUploading ? <p>Uploading image...</p> : <p>Select an image</p>}

        <input
          name="file"
          type="file"
          // We hide the input so we can use our own label as trigger
          style={{ display: "none" }}
          onChange={(event) => submit(event.currentTarget.files)}
        />
      </label>

      <ul>
        {/*
         * Here we render the list of images including the ones we're uploading
         * and the ones we've already uploaded
         */}
        {images.map((file) => {
          return <Image key={file.name} name={file.name} url={file.url} />;
        })}
      </ul>
    </main>
  );
}

function useFileUpload() {
  let { submit, data, state, formData } = useFetcher<typeof action>();
  let isUploading = state !== "idle";

  let uploadingFiles = formData
    ?.getAll("file")
    ?.filter((value: unknown): value is File => value instanceof File)
    .map((file) => {
      let name = file.name;
      // This line is important, this will create an Object URL, which is a `blob:` URL string
      // We'll need this to render the image in the browser as it's being uploaded
      let url = URL.createObjectURL(file);
      return { name, url };
    });

  let images = (data?.files ?? []).concat(uploadingFiles ?? []);

  return {
    submit(files: FileList | null) {
      if (!files) return;
      let formData = new FormData();
      for (let file of files) formData.append("file", file);
      submit(formData, { method: "POST", encType: "multipart/form-data" });
    },
    isUploading,
    images,
  };
}

function Image({ name, url }: { name: string; url: string }) {
  // Here we store the object URL in a state to keep it between renders
  let [objectUrl] = useState(() => {
    if (url.startsWith("blob:")) return url;
    return undefined;
  });

  useEffect(() => {
    // If there's an objectUrl but the `url` is not a blob anymore, we revoke it
    if (objectUrl && !url.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
  }, [objectUrl, url]);

  return (
    <img
      alt={name}
      src={url}
      width={320}
      height={240}
      style={{
        // Some styles, here we apply a blur filter when it's being uploaded
        transition: "filter 300ms ease",
        filter: url.startsWith("blob:") ? "blur(4px)" : "blur(0)",
      }}
    />
  );
}
