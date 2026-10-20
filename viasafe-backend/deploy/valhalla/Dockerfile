# Valhalla routing server for Cluj-Napoca, with the map already built into the image
# so it starts in seconds on Cloud Run instead of rebuilding the routes each time.
# deploy-cloudrun.ps1 copies the tiles from your local "valhalla" container into ./custom_files first.
FROM ghcr.io/nilsnolde/docker-valhalla/valhalla:latest

# The base image runs as a normal user; copying and changing permissions needs root.
# Its start script refuses to run if /custom_files is owned by root, so hand it to the image's own user (59999).
USER root
COPY custom_files/ /custom_files/
RUN chown -R 59999:59999 /custom_files && chmod -R a+rwX /custom_files

ENV server_threads=2 \
    use_tiles_ignore_pbf=True \
    force_rebuild=False \
    serve_tiles=True

EXPOSE 8002
